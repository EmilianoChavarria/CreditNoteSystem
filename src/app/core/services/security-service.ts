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

}
