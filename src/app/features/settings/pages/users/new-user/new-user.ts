import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, Validators, ɵInternalFormsSharedModule, ReactiveFormsModule, AsyncValidatorFn, AbstractControl } from '@angular/forms';
import { LucideAngularModule } from "lucide-angular";
import { TranslatePipe } from '@ngx-translate/core';
import { Role, User } from '../../../../../data/interfaces/User';
import { RoleService } from '../../../../../core/services/role-service';
import { UserService } from '../../../../../core/services/user-service';
import { SecurityService } from '../../../../../core/services/security-service';
import { map, catchError, of, debounceTime, distinctUntilChanged, switchMap, forkJoin, Observable, finalize } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Spinner } from '../../../../../shared/components/ui/spinner/spinner';

interface UserData {
  id: number
  fullName: string
  role: Role

}

@Component({
  selector: 'app-new-user',
  imports: [LucideAngularModule, TranslatePipe, ɵInternalFormsSharedModule, ReactiveFormsModule, Spinner],
  templateUrl: './new-user.html',
  styleUrl: './new-user.css',
})
export class NewUser implements OnInit {

  public roles = signal<Role[]>([]);
  public users = signal<UserData[]>([]);
  public submitted = signal(false);
  public passwordErrors = signal<string[]>([]);
  public isEdit = signal(false);
  public editUserId = signal<number | null>(null);

  public showPassword: boolean = false;

  public form = new FormGroup({
    fullName: new FormControl<string>('', Validators.required),
    email: new FormControl<string>('', [Validators.required, Validators.email]),
    password: new FormControl<string>('', [Validators.required], [this.passwordValidator()]),
    roleId: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    supervisorId: new FormControl<number>(0, [Validators.required, Validators.min(1)]),
    preferredLanguage: new FormControl<string>('DEF', [Validators.required, Validators.pattern(/^(en|es)$/)]),
  })
  public isLoading = signal(true);

  toastr = inject(ToastrService);

  constructor(
    private _roleService: RoleService,
    private _userService: UserService,
    private _securityService: SecurityService,
    private _route: ActivatedRoute,
    private router: Router

  ) {

  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  private loadInitialData(): void {
    this.isLoading.set(true);
    const editParam = this._route.snapshot.queryParamMap.get('edit');
    const parsedUserId = Number(this._route.snapshot.queryParamMap.get('id'));
    const shouldEdit = editParam === 'true' && Number.isFinite(parsedUserId) && parsedUserId > 0;

    this.isEdit.set(shouldEdit);
    this.editUserId.set(shouldEdit ? parsedUserId : null);
    this.configurePasswordValidation();

    if (shouldEdit) {
      forkJoin({
        roles: this.getRoles(),
        users: this.getUsers(),
        user: this._userService.getUserById(parsedUserId),
      }).pipe(
        finalize(() => {
          this.isLoading.set(false);
        })
      ).subscribe({
        next: ({ roles, users, user }) => {
          this.roles.set(roles);
          this.users.set(users);
          this.patchForm(user);
        },
        error: (error) => {
          console.log(error);
          this.toastr.error('No fue posible cargar el usuario para edición', 'Error');
        }
      });

      return;
    }

    forkJoin({
      roles: this.getRoles(),
      users: this.getUsers(),
    }).pipe(
      finalize(() => {
        this.isLoading.set(false);
      })
    ).subscribe({
      next: ({ roles, users }) => {
        this.roles.set(roles);
        this.users.set(users);
      },
      error: (error) => {
        console.log(error);
      }
    });
  }

  getRoles(): Observable<Role[]> {
    return this._roleService.getRoles();
  }

  getUsers(): Observable<UserData[]> {
    return this._userService.getUsers().pipe(
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
    )
  }

  private configurePasswordValidation(): void {
    const passwordControl = this.form.get('password');
    if (!passwordControl) {
      return;
    }

    if (this.isEdit()) {
      passwordControl.clearValidators();
      passwordControl.clearAsyncValidators();
      passwordControl.setValue('');
      this.passwordErrors.set([]);
      passwordControl.updateValueAndValidity();
      return;
    }

    passwordControl.setValidators([Validators.required]);
    passwordControl.setAsyncValidators([this.passwordValidator()]);
    passwordControl.updateValueAndValidity();
  }

  private patchForm(user: User): void {
    const resolvedRoleId = user.roleId ?? user.role?.id ?? 0;
    const resolvedSupervisorId = typeof user.supervisorId === 'number'
      ? user.supervisorId
      : user.supervisorId?.id ?? 0;

    this.form.patchValue({
      fullName: user.fullName ?? '',
      email: user.email ?? '',
      roleId: resolvedRoleId,
      supervisorId: resolvedSupervisorId,
      preferredLanguage: user.preferredLanguage ?? 'DEF',
      password: '',
    });
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

  private get userPayload(): Partial<User> {
    const payload = { ...this.form.getRawValue() } as Partial<User> & { password?: string };
    if (this.isEdit() && !payload.password) {
      delete payload.password;
    }
    return payload;
  }

  saveUser() {
    this.submitted.set(true);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return;
    }

    this.isLoading.set(true);

    if (this.isEdit() && this.editUserId()) {
      return this._userService.updateUser(this.editUserId() as number, this.userPayload).pipe(
        finalize(() => {
          this.isLoading.set(false);
        })
      ).subscribe(
        (response: any) => {
          console.log(response);
          this.router.navigate(['app/settings/users'])
          this.toastr.success(response.message ?? 'Usuario actualizado', 'Exito');
        },
        (error) => {
          console.log(error);
        }
      )
    }

    return this._userService.saveUser(this.userPayload).pipe(
      finalize(() => {
        this.isLoading.set(false);
      })
    ).subscribe(
      (response) => {
        console.log(response);
        this.router.navigate(['app/settings/users'])
        this.toastr.success(response.message, 'Exito');
      },
      (error) => {
        console.log(error);
      }
    )

  }

}
