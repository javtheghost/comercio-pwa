export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    token: string;
    token_type: string;
    expires_at?: string;
  };
}

export interface User {
  id: number;
  name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  email_verified_at?: string;
  created_at: string;
  updated_at: string;
  role?: string;
  roles?: Array<{
    id: number;
    name: string;
    description?: string;
  }>;
  avatar?: string;
  oauth_provider?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  password_confirmation: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  password: string;
  password_confirmation: string;
  token: string;
}
