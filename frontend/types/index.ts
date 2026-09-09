/**
 * VazhiAPI Frontend — Type Definitions
 * Mirrors Pydantic schemas from FastAPI backend
 */

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  full_name?: string;
}

export interface AnalyseRequest {
  text: string;
  language?: "en" | "ta" | "auto";
  include_debug?: boolean;
}

export interface PipelineResult {
  request_id: string;
  processing_time_ms: number;

  // NLP
  language: "en" | "ta";
  detected_keywords: string[];
  crisis: {
    level: "critical" | "severe" | "high" | "moderate" | "low";
    should_escalate: boolean;
    triggered_flags: { phrase: string; severity: string }[];
  };

  // L1 FFNN
  stress_score: number;
  stress_label: "Critical" | "High" | "Moderate" | "Low";
  top_keywords: string[];

  // L2 TextCNN
  debt_category: string;
  debt_category_label: string;
  debt_category_probabilities: Record<string, number>;

  // L3 BiLSTM
  crisis_trajectory: "Rising" | "Stable" | "Declining";
  predicted_peak_score: number;
  stress_history: number[];

  // L4 Seq2Seq
  generated_response: string;
  attention_weights: Record<string, number>;

  // L5 PPO/DQN
  rl_action: "validate" | "legal_rights" | "shg_alternative" | "escalate";
  rl_action_label: string;
  rl_action_description: string;
  rl_action_probabilities: Record<string, number>;

  // L6 Imitation
  refined_response: string;
  raw_response_before_refinement: string;

  // Debug
  pipeline_debug?: {
    l1_ffnn: Record<string, unknown>;
    l2_textcnn: Record<string, unknown>;
    l3_bilstm: Record<string, unknown>;
    l4_seq2seq: Record<string, unknown>;
    l5_drl: Record<string, unknown>;
    l6_imitation: Record<string, unknown>;
    nlp_preprocessed: Record<string, unknown>;
  };
}

export interface Session {
  session_id: string;
  request_id: string;
  created_at: string;
  stress_score: number;
  stress_label: string;
  debt_category: string;
  crisis_trajectory: string;
  rl_action: string;
}

export interface GovernmentScheme {
  id: string;
  name: string;
  name_ta: string;
  authority: string;
  type: string;
  benefit: string;
  eligibility: string[];
  applicable_categories: string[];
  application_url: string;
  helpline: string;
  description: string;
  description_ta: string;
  priority: number;
}

export interface DashboardSummary {
  user_id: string;
  has_data: boolean;
  stress_trend: { date: string; score: number }[];
  category_breakdown: Record<string, number>;
  current_risk?: {
    score: number;
    label: string;
    category: string;
    trajectory: string;
  };
  session_count: number;
  last_session?: string;
}

export type Language = "en" | "ta";
