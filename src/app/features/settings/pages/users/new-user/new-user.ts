import { Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ɵInternalFormsSharedModule, ReactiveFormsModule, AsyncValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { LucideAngularModule } from "lucide-angular";
import { TranslatePipe } from '@ngx-translate/core';
import { Role, User } from '../../../../../data/interfaces/User';
import { RoleService } from '../../../../../core/services/role-service';
import { UserService } from '../../../../../core/services/user-service';
import { SecurityService } from '../../../../../core/services/security-service';
import { map, catchError, of, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import { Router } from '@angular/router';

interface UserData {
  id: number
  fullName: string
  role: Role

}

@Component({
  selector: 'app-new-user',
  imports: [LucideAngularModule, TranslatePipe, ɵInternalFormsSharedModule, ReactiveFormsModule],
  templateUrl: './new-user.html',
  styleUrl: './new-user.css',
})
export class NewUser implements OnInit {

  public roles = signal<Role[]>([]);
  public users = signal<UserData[]>([]);
  public submitted = signal(false);
  public passwordErrors = signal<string[]>([]);

  public showPassword: boolean = false;

  public form = new FormGroup({
    fullName: new FormControl<string>('', Validators.required),
    email: new FormControl<string>('', [Validators.required, Validators.email]),
    password: new FormControl<string>('', [Validators.required], [this.passwordValidator()]),
    roleId: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    supervisorId: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    preferredLanguage: new FormControl<string>('DEF', [Validators.required, Validators.pattern(/^(en|es)$/)]),
  })

  constructor(
    private _roleService: RoleService,
    private _userService: UserService,
    private _securityService: SecurityService,
    private router: Router

  ) {

  }

  ngOnInit(): void {
    this.getRoles();
    this.getUsers();
  }

  getRoles() {
    this._roleService.getRoles().subscribe(
      (response) => {
        return this.roles.set(response);
      },
      (response) => {
        return this.roles = response;
      }
    )
  }

  getUsers() {
    this._userService.getUsers().pipe(
      map((users) => {
        return users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          role: {
            id: user.role?.id ?? 0,
            roleName: user.role?.roleName ?? '',
          }
        }))
      })
    ).subscribe(
      (response: UserData[]) => {
        this.users.set(response)
      }
    )
  }

  passwordValidator(): AsyncValidatorFn {
    return (control: AbstractControl) => {
      if (!control.value || control.value.length === 0) {
        this.passwordErrors.set([]);
        return of(null);
      }

      return of(control.value).pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(password =>
          this._securityService.validatePassword(password).pipe(
            map(response => {
              if (response?.isValid) {
                this.passwordErrors.set([]);
                return null;
              }
              return { passwordInvalid: true };
            }),
            catchError((error) => {
              if (error?.error?.errors?.errors) {
                this.passwordErrors.set(error.error.errors.errors);
              } else {
                this.passwordErrors.set(['Error al validar la contraseña']);
              }
              return of({ passwordInvalid: true });
            })
          )
        )
      );
    };
  }

  togglePassword(): boolean {
    return this.showPassword = !this.showPassword;
  }

  campoVacio(controlName: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || this.submitted());
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }

    if (control.errors['email']) {
      return 'Ingresa un correo válido';
    }

    if (control.errors['passwordInvalid']) {
      return ''; // Los errores específicos se muestran desde passwordErrors
    }

    if (control.errors['min']) {
      return 'Selecciona una opción válida';
    }

    if (control.errors['pattern']) {
      return 'Selecciona un idioma válido';
    }

    return 'Valor no válido';
  }

  get currentUser(): User {
    const usuario = this.form.value as User;
    return usuario;
  }

  saveUser() {
    this.submitted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    return this._userService.saveUser(this.currentUser).subscribe(
      (response) => {
        console.log(response);
        this.router.navigate(['/app/setting/users'])
      },
      (error) => {
        console.log(error);
      }
    )

  }

}
