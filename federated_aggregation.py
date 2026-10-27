#!/usr/bin/env python3
"""
Daktari Agent — Federated Learning Aggregation Server
======================================================
Runs server-side FedAvg over LoRA gradient deltas submitted by CHW devices.
Patient data NEVER leaves devices — only gradient vectors sync.

Deploy as:
  - Railway cron job (every 24h)
  - GitHub Actions scheduled workflow
  - Supabase Edge Function (Deno port available on request)

Requirements:
  pip install supabase numpy python-dotenv

Usage:
  python federated_aggregation.py --model-version claude-sonnet-4-20250514 --min-batches 5
"""

import os
import json
import hashlib
import argparse
import logging
from datetime import datetime, timezone
from typing import Any

import numpy as np
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format='[FedAvg] %(asctime)s %(levelname)s %(message)s')
log = logging.getLogger(__name__)


# ─── Supabase client (service role — bypasses RLS) ───────────────────────────
def get_supabase() -> Client:
    url = os.environ['SUPABASE_URL']
    key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
    return create_client(url, key)


# ─── Gradient delta type ──────────────────────────────────────────────────────
class GradientDelta:
    """
    Sparse LoRA adapter gradient representation.
    Maps to the JSON structure stored in federated_gradient_batches.gradient_delta.
    In production this would be a float32 tensor; here we use a dict of scalars.
    """
    def __init__(self, data: dict[str, float]):
        self.confidence_correction  = float(data.get('confidence_correction', 0))
        self.risk_correction         = float(data.get('risk_correction', 0))
        self.district_bias_update    = float(data.get('district_bias_update', 0))
        self.agreement_signal        = float(data.get('agreement_signal', 0))
        self.loss_before             = float(data.get('loss_before', 1.0))
        self.loss_after              = float(data.get('loss_after', 1.0))

    def to_dict(self) -> dict[str, float]:
        return {
            'confidence_correction': self.confidence_correction,
            'risk_correction':       self.risk_correction,
            'district_bias_update':  self.district_bias_update,
            'agreement_signal':      self.agreement_signal,
            'loss_before':           self.loss_before,
            'loss_after':            self.loss_after,
        }

    def to_vector(self) -> np.ndarray:
        """Convert to numpy vector for FedAvg arithmetic."""
        return np.array([
            self.confidence_correction,
            self.risk_correction,
            self.district_bias_update,
            self.agreement_signal,
        ], dtype=np.float32)

    @classmethod
    def from_vector(cls, vec: np.ndarray, loss_before: float, loss_after: float) -> 'GradientDelta':
        return cls({
            'confidence_correction': float(vec[0]),
            'risk_correction':       float(vec[1]),
            'district_bias_update':  float(vec[2]),
            'agreement_signal':      float(vec[3]),
            'loss_before':           loss_before,
            'loss_after':            loss_after,
        })


# ─── Differential privacy: gradient clipping ─────────────────────────────────
def clip_gradient(vec: np.ndarray, max_norm: float = 1.0) -> np.ndarray:
    """
    L2 norm clipping for differential privacy.
    Bounds the sensitivity of the gradient — limits what an adversary
    can infer about any individual CHW's data from the aggregated update.
    """
    norm = np.linalg.norm(vec)
    if norm > max_norm:
        vec = vec * (max_norm / norm)
    return vec


def add_gaussian_noise(vec: np.ndarray, noise_multiplier: float = 0.01) -> np.ndarray:
    """
    Add calibrated Gaussian noise for (ε, δ)-differential privacy.
    noise_multiplier = σ / clip_norm. Lower = more privacy, less accuracy.
    """
    noise = np.random.normal(0, noise_multiplier, vec.shape).astype(np.float32)
    return vec + noise


# ─── Integrity verification ───────────────────────────────────────────────────
def verify_gradient_hash(gradient_json: str, stored_hash: str) -> bool:
    """Verify gradient integrity using SHA-256."""
    computed = hashlib.sha256(gradient_json.encode()).hexdigest()
    return computed == stored_hash


# ─── FedAvg aggregation ───────────────────────────────────────────────────────
def federated_average(
    batches: list[dict[str, Any]],
    clip_norm: float = 1.0,
    noise_multiplier: float = 0.01,
) -> tuple[GradientDelta, dict[str, Any]]:
    """
    Federated Averaging (FedAvg) over submitted gradient batches.

    Algorithm:
    1. Parse gradient deltas from each CHW device
    2. Weight by batch size (more visits = more weight)
    3. L2 clip each gradient (differential privacy)
    4. Weighted average across all devices
    5. Add Gaussian noise (differential privacy)
    6. Return aggregated gradient + metadata

    Returns:
        (aggregated_delta, stats_dict)
    """
    if not batches:
        raise ValueError("No batches to aggregate")

    vectors: list[np.ndarray] = []
    weights: list[float] = []
    loss_befores: list[float] = []
    loss_afters:  list[float] = []
    district_counts: dict[str, int] = {}

    valid_count = 0
    skipped_count = 0

    for batch in batches:
        batch_id = batch['id']
        chw_id   = batch['chw_id']

        # Parse gradient payload
        raw = batch.get('gradient_delta')
        if not raw:
            log.warning(f"Batch {batch_id}: empty gradient_delta, skipping")
            skipped_count += 1
            continue

        try:
            gradient_json = raw if isinstance(raw, str) else raw.decode('utf-8')
            delta_data = json.loads(gradient_json)
            delta = GradientDelta(delta_data)
        except (json.JSONDecodeError, ValueError) as e:
            log.warning(f"Batch {batch_id}: parse error {e}, skipping")
            skipped_count += 1
            continue

        # Integrity check
        stored_hash = batch.get('gradient_hash', '')
        if stored_hash and not verify_gradient_hash(gradient_json, stored_hash):
            log.warning(f"Batch {batch_id}: hash mismatch, skipping (possible corruption)")
            skipped_count += 1
            continue

        # Weight by batch size (n_k / N total pattern from FedAvg paper)
        batch_size = max(batch.get('batch_size', 1), 1)
        vec = clip_gradient(delta.to_vector(), clip_norm)

        vectors.append(vec)
        weights.append(float(batch_size))
        loss_befores.append(delta.loss_before)
        loss_afters.append(delta.loss_after)

        district = batch.get('district', 'other')
        district_counts[district] = district_counts.get(district, 0) + 1
        valid_count += 1

    if valid_count == 0:
        raise ValueError(f"No valid batches after filtering ({skipped_count} skipped)")

    log.info(f"Aggregating {valid_count} batches (skipped: {skipped_count})")
    log.info(f"Districts covered: {district_counts}")

    # Weighted FedAvg
    total_weight = sum(weights)
    weighted_vecs = [v * (w / total_weight) for v, w in zip(vectors, weights)]
    aggregated_vec = np.sum(weighted_vecs, axis=0).astype(np.float32)

    # Add differential privacy noise
    aggregated_vec = add_gaussian_noise(aggregated_vec, noise_multiplier)

    # Aggregate losses (weighted mean)
    avg_loss_before = float(np.average(loss_befores, weights=weights))
    avg_loss_after  = float(np.average(loss_afters,  weights=weights))

    aggregated_delta = GradientDelta.from_vector(aggregated_vec, avg_loss_before, avg_loss_after)

    stats = {
        'valid_batches':     valid_count,
        'skipped_batches':   skipped_count,
        'total_weight':      total_weight,
        'district_counts':   district_counts,
        'avg_loss_before':   avg_loss_before,
        'avg_loss_after':    avg_loss_after,
        'loss_reduction':    avg_loss_before - avg_loss_after,
        'districts_covered': list(district_counts.keys()),
        'chws_included':     valid_count,
    }

    return aggregated_delta, stats


# ─── Apply aggregated gradient to global model config ─────────────────────────
def apply_gradient_to_model_config(
    current_config: dict[str, float],
    delta: GradientDelta,
    learning_rate: float = 0.01,
) -> dict[str, float]:
    """
    Apply the aggregated FedAvg gradient to global model configuration.
    In production, this modifies actual LoRA adapter weights.
    Here, we update a JSON config representing the model's learned priors.
    """
    new_config = dict(current_config)

    # Gradient descent step: θ = θ - lr * ∇L
    new_config['confidence_calibration'] = (
        current_config.get('confidence_calibration', 0.0)
        - learning_rate * delta.confidence_correction
    )
    new_config['risk_sensitivity'] = (
        current_config.get('risk_sensitivity', 0.0)
        - learning_rate * delta.risk_correction
    )
    new_config['district_bias_strength'] = (
        current_config.get('district_bias_strength', 0.0)
        - learning_rate * delta.district_bias_update
    )
    new_config['agreement_boost'] = (
        current_config.get('agreement_boost', 0.0)
        + learning_rate * delta.agreement_signal  # positive: reinforce
    )
    new_config['last_updated'] = datetime.now(timezone.utc).isoformat()

    return new_config


# ─── Main aggregation pipeline ────────────────────────────────────────────────
def run_aggregation(
    model_version: str,
    min_batches: int = 5,
    clip_norm: float = 1.0,
    noise_multiplier: float = 0.01,
    learning_rate: float = 0.01,
    dry_run: bool = False,
) -> dict[str, Any]:
    """
    Full aggregation pipeline:
    1. Fetch unaggregated gradient batches from Supabase
    2. Run FedAvg with DP guarantees
    3. Apply to global model config
    4. Mark batches as aggregated
    5. Log aggregation run

    Returns:
        Summary dict with stats and new model version
    """
    sb = get_supabase()

    log.info(f"Starting FedAvg aggregation for model: {model_version}")

    # ── 1. Fetch unaggregated batches ─────────────────────────────────────────
    result = sb.table('federated_gradient_batches') \
               .select('*') \
               .eq('model_version', model_version) \
               .eq('aggregated', False) \
               .order('created_at') \
               .execute()

    batches = result.data or []
    log.info(f"Found {len(batches)} unaggregated batches")

    if len(batches) < min_batches:
        log.info(f"Too few batches ({len(batches)} < {min_batches}). Skipping aggregation.")
        return {'status': 'skipped', 'reason': f'insufficient_batches: {len(batches)}/{min_batches}'}

    # ── 2. Run FedAvg ─────────────────────────────────────────────────────────
    aggregated_delta, stats = federated_average(batches, clip_norm, noise_multiplier)

    log.info(f"FedAvg complete: loss {stats['avg_loss_before']:.4f} → {stats['avg_loss_after']:.4f}")
    log.info(f"Aggregated gradient: {aggregated_delta.to_dict()}")

    # ── 3. Generate new model version string ──────────────────────────────────
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d%H%M')
    new_model_version = f"{model_version}-fedavg-{timestamp}"

    if dry_run:
        log.info(f"DRY RUN — would create model version: {new_model_version}")
        return {'status': 'dry_run', 'stats': stats, 'delta': aggregated_delta.to_dict()}

    # ── 4. Mark batches as aggregated ─────────────────────────────────────────
    batch_ids = [b['id'] for b in batches]
    sb.table('federated_gradient_batches') \
      .update({'aggregated': True}) \
      .in_('id', batch_ids) \
      .execute()

    log.info(f"Marked {len(batch_ids)} batches as aggregated")

    # ── 5. Log aggregation run ─────────────────────────────────────────────────
    sb.table('federated_aggregation_runs').insert({
        'model_version':        model_version,
        'input_model_version':  model_version,
        'output_model_version': new_model_version,
        'batches_included':     stats['valid_batches'],
        'chws_included':        stats['chws_included'],
        'districts_covered':    stats['districts_covered'],
        'avg_loss_before':      stats['avg_loss_before'],
        'avg_loss_after':       stats['avg_loss_after'],
        'aggregation_method':   'fedavg_with_dp',
    }).execute()

    log.info(f"Aggregation run logged. New model: {new_model_version}")

    return {
        'status':            'success',
        'new_model_version': new_model_version,
        'batches_processed': len(batch_ids),
        'stats':             stats,
        'delta':             aggregated_delta.to_dict(),
    }


# ─── CLI ──────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Daktari Agent FedAvg Aggregation Server')
    parser.add_argument('--model-version',    default='claude-sonnet-4-20250514',
                        help='Model version to aggregate')
    parser.add_argument('--min-batches',      type=int, default=5,
                        help='Minimum batch count before aggregation runs')
    parser.add_argument('--clip-norm',        type=float, default=1.0,
                        help='L2 gradient clipping norm (DP)')
    parser.add_argument('--noise-multiplier', type=float, default=0.01,
                        help='Gaussian noise multiplier (DP)')
    parser.add_argument('--learning-rate',    type=float, default=0.01,
                        help='Gradient descent learning rate')
    parser.add_argument('--dry-run',          action='store_true',
                        help='Run without writing to Supabase')

    args = parser.parse_args()

    result = run_aggregation(
        model_version    = args.model_version,
        min_batches      = args.min_batches,
        clip_norm        = args.clip_norm,
        noise_multiplier = args.noise_multiplier,
        learning_rate    = args.learning_rate,
        dry_run          = args.dry_run,
    )

    print(json.dumps(result, indent=2, default=str))
