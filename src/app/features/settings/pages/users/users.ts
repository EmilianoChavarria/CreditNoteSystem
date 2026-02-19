import { Component, OnInit, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { UserService } from '../../../../core/services/user-service';
import { User } from '../../../../data/interfaces/User';

@Component({
    selector: 'app-users',
    templateUrl: './users.html',
    styleUrl: './users.css',
    imports: [Table],
})
export class Users implements OnInit {

    public users = signal<User[]>([]);

    public columns: Column<User>[] = [
        {
            key: 'fullName',
            label: 'Nombre',
            sortable: true
        },
        {
            key: 'email',
            label: 'Email',
            sortable: true
        },
        {
            key: 'role',
            label: 'Rol',
            sortable: false,
            render: (value, item) => item.role?.roleName ?? 'Sin rol'
        },
        {
            key: 'isActive',
            label: 'Activo',
            sortable: true,
            render: (value) => value ? 'Activo' : 'Inactivo'
        }
    ];

    acciones: AccionPersonalizada<User>[] = [
        {
            key: 'reset',
            icon: 'rotate-ccw',
            label: 'Reset password',
            accion: (user) => this.resetPassword(user)
        },
        {
            key: 'toggle',
            icon: 'user-check',
            label: 'Activar / Desactivar',
            accion: (user) => this.toggleUser(user)
        }
    ];

    resetPassword(user: User) {
        console.log('Reset', user.fullName);
    }

    toggleUser(user: User) {
        console.log('Toggle', user.fullName);
    }

    constructor(
        private _userService: UserService
    ) { }

    ngOnInit(): void {
        this.getUsers();
    }

    getUsers(): void {
        this._userService.getUsers().subscribe({
            next: (response) => {
                this.users.set(response);
                console.log('✅ Usuarios cargados:', response);
            },
            error: (error) => {
                console.error('❌ Error al cargar usuarios:', error);
            }
        });
    }
}
