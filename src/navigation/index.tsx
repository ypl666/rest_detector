// src/navigation/index.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import DetectScreen from '../screens/DetectScreen';

export type RootStackParamList = {
  Home: undefined;
  Detect: { task: 'drink_water' | 'leave_seat' | 'stretch' };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function Navigation() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Detect" component={DetectScreen} />
    </Stack.Navigator>
  );
}