'use client';

import React from 'react';
import { Area, AreaChart, XAxis, YAxis } from 'recharts';
import StableResponsiveContainer from '@/components/shared/charts/StableResponsiveContainer';

export type ProfileEvolutionChartPoint = {
  date: string;
  taxa: number;
  total: number;
};

export default function ProfileEvolutionChart({ data }: { data: ProfileEvolutionChartPoint[] }) {
  return (
    <StableResponsiveContainer height={96}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorTotalProfile" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.1} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={20} />
        <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#colorTotalProfile)" name="Quantidade" fillOpacity={1} />
        <Area type="monotone" dataKey="taxa" stroke="#6366f1" strokeWidth={1} fillOpacity={0} name="Precisao (%)" />
      </AreaChart>
    </StableResponsiveContainer>
  );
}
