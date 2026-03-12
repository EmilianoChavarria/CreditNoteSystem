import { Component, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { Customer } from '../../../../data/interfaces/Customer';
import { CustomerService } from '../../../../core/services/customer-service';
import { LucideAngularModule } from "lucide-angular";
import { finalize } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { AssignManagersPayload, AssignModal } from "./components/assign-modal/assign-modal";

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
    public totalPages = signal<number>(1);
    public isLoadingTable = signal<boolean>(true);
    public customers = signal<Customer[]>([]);
    public customer?: Customer;

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
            label: 'See Info',
            accion: (user) => this.openModal(user)
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

    public openModal(customer: Customer) {
        this.showModal(true);
        console.log(customer);
        this.customer = customer;
    }

    public showModal(isOpen: boolean) {
        this.isOpenModal.set(isOpen);
    }

    public assignManagers(payload: AssignManagersPayload) {
        console.log('Assign managers payload:', payload);
        let newObject = {
            idClient: this.customer?.idCliente,
            salesEngineerId: payload.salesEngineer,
            salesManagerId: payload.salesManager,
            financeManagerId: payload.financeManager,
            marketingManagerId: payload.marketingManager,
            customerServiceManagerId: payload.csManager,
            area: payload.area
        }
        console.log(newObject);

        this._customerService.saveExtraData(newObject).subscribe({
            next: (response) => {
                console.log(response);
            },
            error: (error) => {
                console.log(error);
            }
        })
        this.showModal(false);
        this.getUsers();
    }

    onNextPage(): void {
        const page = this.currentPage();
        const lastPage = this.totalPages();

        if (page >= lastPage) {
            return;
        }

        this.getUsers(page + 1);
    }

    onPrevPage(): void {
        const page = this.currentPage();

        if (page <= 1) {
            return;
        }

        this.getUsers(page - 1);
    }

    onFirstPage(): void {
        if (this.currentPage() === 1) {
            return;
        }

        this.getUsers(1);
    }

    onLastPage(): void {
        const lastPage = this.totalPages();

        if (this.currentPage() === lastPage) {
            return;
        }

        this.getUsers(lastPage);
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
        this.totalPages.set(1);
        this.getUsers(1);
    }

    getUsers(page = 1): void {
        this.isLoadingTable.set(true);

        this._customerService.getCustomersPaginated(this.pageSize(), page).pipe(
            finalize(() => this.isLoadingTable.set(false))
        ).subscribe({
            next: (response) => {
                this.customers.set(response.data);
                this.currentPage.set(response.current_page ?? page);
                this.totalPages.set(response.last_page ?? 1);
                this.hasNextPage.set(!!response.next_page_url);
                this.hasPrevPage.set(!!response.prev_page_url);
                // console.log('✅ Usuarios cargados:', response);
            },
            error: (error) => {
                console.error('❌ Error al cargar usuarios:', error);
            }
        });
    }

}
