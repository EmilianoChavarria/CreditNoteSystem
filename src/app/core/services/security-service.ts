import { Injectable } from '@angular/core';
import { HttpService } from './http-service';
import { map } from 'rxjs';

export interface PasswordValidationResponse {
  isValid: boolean;
  requirements: {
    id: number;
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: number;
    allowedSpecialChars: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface PasswordRequirementField {
  label: string;
  value: string | number | boolean;
  description: string;
  allowedChars?: string;
}

export interface PasswordRequirementsFormatted {
  minLength: PasswordRequirementField;
  requireUppercase: PasswordRequirementField;
  requireLowercase: PasswordRequirementField;
  requireNumbers: PasswordRequirementField;
  requireSpecialChars: PasswordRequirementField;
}

export interface LoginAttemptSettings {
  id: number;
  maxUserAttempts: number;
  maxIpAttempts: number;
  sessionTimeoutMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLoginAttemptSettingsPayload {
  maxUserAttempts: number;
  maxIpAttempts: number;
  sessionTimeoutMinutes: number;
}

export interface UpdatePasswordRequirementsPayload {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  allowedSpecialChars: string;
}

export interface BlockedUsersResponse {
  current_page: number;
  data: BlockedUserApi[];
  last_page: number;
  per_page: number;
  next_page_url: string | null;
  prev_page_url: string | null;
  total: number;
}

export interface BlockedIpsResponse {
  current_page: number;
  data: BlockedIpApi[];
  last_page: number;
  per_page: number;
  next_page_url: string | null;
  prev_page_url: string | null;
  total: number;
}

export interface BlockedUserApi {
  id: number;
  fullName: string;
  email: string;
  reason?: string | null;
  blockedAt?: string | null;
  security?: {
    failedAttempts?: number;
    lastFailedAt?: string | null;
    lockedUntil?: string | null;
    lastKnownIp?: string | null;
  };
}

export interface BlockedIpApi {
  ipAddress: string;
  failedAttempts: number;
  isBlockedPermanently: boolean;
  reason?: string | null;
  blockedAt: string | null;
  blockedHistoryAt?: string | null;
  releasedAt: string | null;
}

export interface ChargePolicy {
  id: number;
  day: number;
  percentage: number;
}

export interface ChargePolicyInput {
  id?: number;
  day: number;
  percentage: number;
}

@Injectable({
  providedIn: 'root'
})
export class SecurityService {

  constructor(
    private _httpService: HttpService
  ) { }

  validatePassword(password: string){
    return this._httpService.post<PasswordValidationResponse>('password-requirements/validate', { password }).pipe(
      map(response => response.data)
    )
  }

  getFormattedPasswordRequirements() {
    return this._httpService.get<PasswordRequirementsFormatted>('password-requirements/formatted').pipe(
      map(response => response.data)
    );
  }

  getLoginAttemptSettings() {
    return this._httpService.get<LoginAttemptSettings>('security/login-attempt-settings').pipe(
      map(response => response.data)
    );
  }

  updateLoginAttemptSettings(payload: UpdateLoginAttemptSettingsPayload) {
    return this._httpService.put<LoginAttemptSettings>('security/login-attempt-settings', payload).pipe(
      map(response => response.data)
    );
  }

  updatePasswordRequirements(payload: UpdatePasswordRequirementsPayload) {
    return this._httpService.put('password-requirements', payload).pipe(
      map(response => response.data)
    );
  }

  getBlockedUsers(page = 1) {
    return this._httpService.get<BlockedUsersResponse>('security/users/blocked', {
      params: { page }
    }).pipe(
      map(response => response.data)
    );
  }

  getBlockedIps(page = 1) {
    return this._httpService.get<BlockedIpsResponse>('security/ips/blocked', {
      params: { page }
    }).pipe(
      map(response => response.data)
    );
  }

  unlockBlockedIp(ipAddress: string) {
    return this._httpService.post<unknown>('security/ips/unlock', { ipAddress });
  }

  unlockBlockedUser(userId: number) {
    return this._httpService.post<unknown>(`security/users/${userId}/unlock`, {});
  }

  getChargePolicies() {
    return this._httpService.get<ChargePolicy[]>('charge-policies').pipe(
      map(response => response.data)
    );
  }

  syncChargePolicies(payload: { policies: ChargePolicyInput[] }) {
    return this._httpService.post<ChargePolicy[]>('charge-policies/sync', payload).pipe(
      map(response => response.data)
    );
  }

  deleteChargePolicy(id: number) {
    return this._httpService.delete<unknown>(`charge-policies/${id}`);
  }

}
