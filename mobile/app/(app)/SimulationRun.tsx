import React from 'react';
import { Redirect } from 'expo-router';

export default function LegacySimulationRunRedirect() {
  return <Redirect href="/simulados/executar" />;
}
