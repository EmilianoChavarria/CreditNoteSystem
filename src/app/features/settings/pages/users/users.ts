import { Component, inject, OnInit, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { UserService } from '../../../../core/services/user-service';
import { User } from '../../../../data/interfaces/User';
import { Router } from '@angular/router';
import { Modal } from '../../../../shared/components/ui/modal/modal';
import { ToastrService } from 'ngx-toastr';
import { Badge } from '../../../../shared/components/ui/badge/badge';
import moment from 'moment';
import { TranslatePipe } from '@ngx-translate/core';
import { finalize } from 'rxjs';
@Component({
    selector: 'app-users',
    templateUrl: './users.html',
    styleUrl: './users.css',
    imports: [Table, Modal, Badge, TranslatePipe],
})
export class Users implements OnInit {
    toastr = inject(ToastrService);
    public users = signal<User[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    private nextCursor = signal<string | null>(null);
    private prevCursor = signal<string | null>(null);
    public showDeleteModal = signal<boolean>(false);
    public selectedUserToDelete = signal<User | null>(null);

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
            key: 'preferredLanguage',
            label: 'Preferred Language',
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
            label: 'Status',
            sortable: true,
            customTemplate: true
        },
        {
            key: 'createdAt',
            label: 'Fecha de Creación',
            sortable: true,
            render: (value) => value ? moment(value).format('DD/MM/YYYY HH:mm:ss') : '-'
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
            key: 'edit',
            icon: 'pencil',
            label: 'Editar',
            accion: (user) => this.editUser(user)
        },
        {
            key: 'delete',
            icon: 'trash',
            label: 'Eliminar',
            accion: (user) => this.openDeleteModal(user)
        }
    ];

    resetPassword(user: User) {
        console.log('Reset', user.fullName);
    }

    toggleUser(user: User) {
        console.log('Toggle', user.fullName);
    }

    editUser(user: User) {
        this._router.navigate(['/app/settings/newUser'], {
            queryParams: {
                edit: true,
                id: user.id
            }
        });
    }

    openDeleteModal(user: User): void {
        this.selectedUserToDelete.set(user);
        this.showDeleteModal.set(true);
    }

    onDeleteModalChange(isOpen: boolean): void {
        this.showDeleteModal.set(isOpen);
        if (!isOpen) {
            this.selectedUserToDelete.set(null);
        }
    }

    cancelDelete(): void {
        this.showDeleteModal.set(false);
        this.selectedUserToDelete.set(null);
    }

    confirmDelete(): void {
        const user = this.selectedUserToDelete();
        if (!user) {
            return;
        }

        console.log('Delete', user.fullName);
        this._userService.deleteUser(user.id).subscribe(
            (response) => {
                this.toastr.success(response.message ?? 'Usuario eliminado', 'Exito');
                this.getUsers();
            },
            (error) => {
                this.toastr.error(error.message ?? 'Error al eliminar', 'Error');
            }
        )
        this.cancelDelete();
    }

    constructor(
        private _userService: UserService,
        private _router: Router
    ) { }

    ngOnInit(): void {
        this.getUsers();
    }

    getUsers(cursor?: string | null): void {
        this.isLoadingTable.set(true);

        this._userService.getUsersPaginated(this.pageSize(), cursor).pipe(
            finalize(() => this.isLoadingTable.set(false))
        ).subscribe({
            next: (response) => {
                this.users.set(response.data);
                this.nextCursor.set(response.next_cursor ?? null);
                this.prevCursor.set(response.prev_cursor ?? null);
                this.hasNextPage.set(!!response.next_cursor || !!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_cursor || !!response.prev_page_url);
                console.log('✅ Usuarios cargados:', response);
            },
            error: (error) => {
                console.error('❌ Error al cargar usuarios:', error);
            }
        });
    }

    onNextPage(): void {
        const cursor = this.nextCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => value + 1);
        this.getUsers(cursor);
    }

    onPrevPage(): void {
        const cursor = this.prevCursor();
        if (!cursor) {
            return;
        }

        this.currentPage.update((value) => Math.max(1, value - 1));
        this.getUsers(cursor);
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.currentPage.set(1);
        this.nextCursor.set(null);
        this.prevCursor.set(null);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.getUsers();
    }
}
