import { Component, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { Customer } from '../../../../data/interfaces/Customer';
import { CustomerService } from '../../../../core/services/customer-service';
import { LucideAngularModule } from "lucide-angular";
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { AssignModal } from "./components/assign-modal/assign-modal";

@Component({
    selector: 'app-customers',
    templateUrl: './customers.html',
    styleUrl: './customers.css',
    imports: [Table, LucideAngularModule, TranslatePipe, AssignModal],
})
export class Customers {

    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    private nextCursor = signal<string | null>(null);
    private prevCursor = signal<string | null>(null);
    public customers = signal<Customer[]>([]);

    public isOpenModal = signal<boolean>(false);

    public columns: Column<Customer>[] = [
        {
            key: 'razonSocial',
            label: 'Customer Name',
            sortable: true
        },
        // {
        //     key: 'customerNumber',
        //     label: 'Sold To',
        //     sortable: true,
        //     render: (value, item) => item.idCliente ?? '-'
        // },
        {
            key: 'rfc',
            label: 'R.F.C',
            sortable: true
        },
        {
            key: 'area',
            label: 'Area',
            sortable: true,
            render: (value, item) => item.customer?.area ?? '-'
        },
        {
            key: 'salesEngineerId',
            label: 'Sales Engineer',
            sortable: true,
            render: (value, item) => item.customer?.salesEngineer?.fullName ?? '-'
        },
        {
            key: 'salesManagerId',
            label: 'Sales Manager',
            sortable: true,
            render: (value, item) => item.customer?.salesManager?.fullName ?? '-'
        },
        {
            key: 'financeManagerId',
            label: 'Finance Manager',
            sortable: true,
            render: (value, item) => item.customer?.financeManager?.fullName ?? '-'
        },
        {
            key: 'marketingManagerId',
            label: 'Marketing Manager',
            sortable: true,
            render: (value, item) => item.customer?.marketingManager?.fullName ?? '-'
        },
        {
            key: 'customerServiceManagerId',
            label: 'CS Manager',
            sortable: true,
            render: (value, item) => item.customer?.customerServiceManager?.fullName ?? '-'
        },
        {
            key: 'estatus',
            label: 'Activo',
            sortable: true,
            render: (value) => value ? 'Activo' : 'Inactivo'
        }
    ];

    headerButtons = [
        {
            label: 'Asignar Manager',
            icon: 'plus',
            className: 'bg-[#0f766e]',
            accion: () => this.toggleUser(),
            useTemplate: true
        }
    ];

    acciones: AccionPersonalizada<Customer>[] = [
        {
            key: 'reset',
            icon: 'user-plus',
            label: 'Assign Manager',
            accion: (user) => this.showModal(true)
        }
    ];

    resetPassword(user: Customer) {
        console.log('Reset');
    }

    toggleUser() {
        console.log('Toggle');
    }

    constructor(
        private _customerService: CustomerService
    ) { }

    ngOnInit(): void {
        this.getUsers();
    }

    public showModal(isOpen: boolean) {
        this.isOpenModal.set(isOpen);
    }

    public assignManagers() {
        console.log("asd");
        this.showModal(false);
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

    getUsers(cursor?: string | null): void {
        this.isLoadingTable.set(true);

        this._customerService.getCustomersPaginated(this.pageSize(), cursor).pipe(
            finalize(() => this.isLoadingTable.set(false))
        ).subscribe({
            next: (response) => {
                this.customers.set(response.data);
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

}
