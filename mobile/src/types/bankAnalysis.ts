export interface BankXrayFilters {
  banca: string;
  cargo?: string;
  ano?: string;
}

export interface BankXrayChartDatum {
  name: string;
  value: number;
}

export interface BankXrayTopicDatum {
  topic: string;
  percent: number;
}

export interface BankXrayBreakdownDatum {
  subject: string;
  total: number;
  percent: number;
  topics: BankXrayTopicDatum[];
}

export interface BankXrayExamDatum {
  id: string | number;
  year: string | number;
  name: string;
}

export interface BankXrayPayload {
  total: number;
  textStyle: string;
  contextUsage: number;
  difficultyData: BankXrayChartDatum[];
  subjectData: BankXrayChartDatum[];
  detailedBreakdown: BankXrayBreakdownDatum[];
  examList: BankXrayExamDatum[];
  recommendation: string;
}
