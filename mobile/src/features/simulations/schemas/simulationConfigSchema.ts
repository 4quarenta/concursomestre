import { z } from 'zod';

export const simulationConfigSchema = z.object({
  questionCount: z.number().int().min(1).max(100),
  timerEnabled: z.boolean(),
  timerMinutes: z.number().int().min(1).max(300),
  keyword: z.string().max(180).optional(),
  difficulty: z.enum(['all', 'easy', 'medium', 'hard']).default('all'),
  feedbackMode: z.enum(['after_all', 'instant']).default('after_all'),
  subjects: z.array(z.string()).default([]),
  agencies: z.array(z.string()).default([]),
  years: z.array(z.string()).default([]),
  organizations: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
});

export type SimulationConfigFormValues = z.infer<typeof simulationConfigSchema>;
