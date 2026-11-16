# Contributing to Daktari AI

Thanks for helping. Daktari supports clinical decisions, so changes that touch triage logic need extra care.

## Setup

```bash
git clone https://github.com/creova-gif/daktari-agent.git
cd daktari-agent
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Before you open a pull request

1. Branch from `main` with a descriptive name, e.g. `fix/ussd-timeout`.
2. Run the unit tests: `python3 -m unittest discover -s tests -v`.
3. Run the full battery that CI runs: `./verify_all.sh`.
4. Add or update tests for any behaviour you change.
5. Never commit secrets, real patient data or `.env` files.
6. Describe what changed, why, and how you tested it.

## Clinical changes

Changes to triage rules, danger signs, dosing or referral thresholds must cite the WHO IMCI/IMPAC or Tanzania MoH guideline they follow and need review by a maintainer before merge.

## Reporting bugs and security issues

- Bugs and feature requests: open a GitHub issue with steps to reproduce.
- Security or patient-safety issues: email creativeinnovationspace@gmail.com instead of filing a public issue.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
