/**
 * VazhiAPI Frontend — Type Definitions (mirror the FastAPI responses)
 */

export type Language = "en" | "ta";
export type MsgLanguage = "en" | "ta" | "tanglish";

export interface AuthUser {
  user_id: string;
  email: string;
  full_name?: string | null;
  district?: string | null;
  preferred_language?: Language;
  is_admin?: boolean;
}

export interface TokenResponse extends AuthUser {
  access_token: string;
  token_type: string;
}

export interface AnalyseRequest {
  text: string;
  language?: "en" | "ta" | "auto";
  include_debug?: boolean;
}

export interface Crisis {
  level: "critical" | "severe" | "high" | "low";
  should_escalate: boolean;
  self_harm_risk?: boolean;
  triggered_flags: { phrase: string; severity: string }[];
}

export interface SchemeLite {
  id: string;
  name: string;
  name_ta: string;
  benefit: string;
  helpline: string;
  application_url: string;
  type: string;
}

export interface Helpline {
  id: string;
  name: string;
  name_ta: string;
  number: string;
  kind: string;
  hours: string;
  for: string[];
}

export interface AnalysisSummary {
  session_id?: string;
  request_id?: string;
  stress_score: number;
  stress_label: "Critical" | "High" | "Moderate" | "Low";
  debt_category: string;
  debt_category_label: string;
  debt_category_label_ta?: string;
  debt_category_icon?: string;
  debt_category_color?: string;
  debt_category_probabilities: Record<string, number>;
  crisis_trajectory?: "Rising" | "Stable" | "Declining";
  predicted_peak_score?: number;
  rl_action: "validate" | "legal_rights" | "shg_alternative" | "escalate";
  rl_action_label: string;
  rl_action_description: string;
  language: MsgLanguage;
  processing_time_ms: number;
  matched_schemes: SchemeLite[];
  helplines: Helpline[];
  crisis: Crisis;
  refined_response?: string;
  attention_weights?: Record<string, number>;
}

export interface PipelineResult extends AnalysisSummary {
  request_id: string;
  session_id: string;
  detected_keywords: string[];
  top_keywords: string[];
  stress_history: number[];
  generated_response: string;
  attention_weights: Record<string, number>;
  rl_action_probabilities: Record<string, number>;
  refined_response: string;
  raw_response_before_refinement: string;
  pipeline_debug?: Record<string, Record<string, unknown>>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  session_id?: string | null;
  created_at?: string;
  meta?: {
    engine?: string;
    intent?: string;
    suggestions?: string[];
    category?: string;
    stress_score?: number;
    crisis_level?: string;
    analysis?: AnalysisSummary;
  };
}

export interface ConversationSummary {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface GovernmentScheme {
  id: string;
  name: string;
  name_ta: string;
  authority: string;
  level?: "state" | "central";
  type: string;
  benefit: string;
  eligibility: string[];
  applicable_categories: string[];
  application_url: string;
  helpline: string;
  description: string;
  description_ta: string;
  priority: number;
  match_score?: number;
  match_reasons?: string[];
}

export interface DebtCategory {
  id: string;
  label: string;
  label_ta: string;
  icon: string;
  color: string;
  description: string;
  description_ta: string;
  legal_status: string;
  risk_level: string;
  typical_amounts: string;
  first_steps: string[];
  first_steps_ta: string[];
}

export interface Law {
  id: string;
  name: string;
  name_ta: string;
  summary: string;
  summary_ta: string;
  your_rights: string[];
  how_to_act: string;
  categories: string[];
}

export interface DashboardSummary {
  user_id: string;
  has_data: boolean;
  stress_trend: { date: string; score: number; category?: string }[];
  category_breakdown: Record<string, number>;
  current_risk?: { score: number; label: string; category: string; trajectory: string; crisis_level?: string } | null;
  trend?: "rising" | "stable" | "declining";
  average_score?: number | null;
  best_score?: number | null;
  primary_category?: string;
  primary_category_info?: { label: string; label_ta: string; icon: string; color: string; first_steps: string[]; first_steps_ta: string[] };
  matched_schemes: GovernmentScheme[];
  session_count: number;
  last_session?: string;
}
