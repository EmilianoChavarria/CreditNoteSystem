import { Component } from '@angular/core';
import { AuthService, LoginCredentials } from '../../../../core/services/auth-service';
import { Router } from '@angular/router';
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-login',
    templateUrl: './login.html',
    styleUrl: './login.css',
    imports: [
        ReactiveFormsModule,
        LucideAngularModule,
        Spinner,
    ],
})
export class Login {

  public showPassword: boolean = false;
  public credentials = {
    email: 'juan@demo.com',
    password: '123asd'
  };
  public isLoading = false;
  public errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private translate: TranslateService,
  ) {

  }

  public form = new FormGroup({
    email: new FormControl<string>('', Validators.required),
    password: new FormControl<string>('', Validators.required),
  })

  togglePassword(): boolean {
    return this.showPassword = !this.showPassword;
  }

  onSubmit(): void {

    this.isLoading = true;
    this.errorMessage = '';

    this.form.get('email')?.disable();
    this.form.get('password')?.disable();

    const object: LoginCredentials = {
      email: this.form.value.email || '',
      password: this.form.value.password || ''
    }

    this.authService.login(object).subscribe({
      next: (response) => {
        if (response.success) {
          const preferredLanguage = response.data?.user?.preferredLanguage;
          if (preferredLanguage === 'es' || preferredLanguage === 'en') {
            this.translate.use(preferredLanguage);
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('lang', preferredLanguage);
            }
          }

          console.log("Fué exitoso el login")
          // La cookie ya fue guardada automáticamente
          this.router.navigate(['/app/dashboard']);
          
        } else {
          this.errorMessage = response.message || 'Error al iniciar sesión';
          this.isLoading = false;
          this.form.get('email')?.enable();
          this.form.get('password')?.enable();
        }
      },
      error: (error) => {
        this.errorMessage = error.error?.message || 'Error de conexión';
        this.isLoading = false;
        this.form.get('email')?.enable();
        this.form.get('password')?.enable();
      }
    });
  }

}
