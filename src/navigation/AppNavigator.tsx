import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';

import { AuthProvider, useAuth } from '../hooks/useAuth';
import { colors } from '../lib/theme';

import LoginScreen from '../screens/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import NewVisitScreen from '../screens/NewVisitScreen';
import AIRecommendationScreen from '../screens/AIRecommendationScreen';
import PatientSearchScreen from '../screens/PatientSearchScreen';
import VisitHistoryScreen from '../screens/VisitHistoryScreen';
import VisitDetailScreen from '../screens/VisitDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import PatientDetailScreen from '../screens/PatientDetailScreen';
import CertificationScreen from '../screens/CertificationScreen';
import BenchResultsScreen from '../screens/BenchResultsScreen';
import EmergencyProtocolScreen from '../screens/EmergencyProtocolScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import StockTrackerScreen from '../screens/StockTrackerScreen';

import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function RootNavigator() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {!session ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="NewVisit" component={NewVisitScreen} />
          <Stack.Screen name="AIRecommendation" component={AIRecommendationScreen} />
          <Stack.Screen name="PatientSearch" component={PatientSearchScreen} />
          <Stack.Screen name="PatientDetail" component={PatientDetailScreen} />
          <Stack.Screen name="VisitHistory" component={VisitHistoryScreen} />
          <Stack.Screen name="VisitDetail" component={VisitDetailScreen} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="Certification" component={CertificationScreen} />
          <Stack.Screen name="BenchResults" component={BenchResultsScreen} />
          <Stack.Screen name="EmergencyProtocol" component={EmergencyProtocolScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="StockTracker" component={StockTrackerScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
