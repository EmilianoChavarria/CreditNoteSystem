import { Component, signal } from '@angular/core';
import { AccionPersonalizada, Column, Table } from "../../../../shared/components/ui/table/table";
import { Customer } from '../../../../data/interfaces/Customer';
import { CustomerService } from '../../../../core/services/customer-service';

@Component({
    selector: 'app-customers',
    templateUrl: './customers.html',
    styleUrl: './customers.css',
    imports: [Table],
})
export class Customers {

    public customers = signal<Customer[]>([]);

    public columns: Column<Customer>[] = [
        {
            key: 'customerNumber',
            label: 'Customer Number',
            sortable: true
        },
        {
            key: 'customerNumber',
            label: 'Sold To',
            sortable: true
        },
        {
            key: 'customerName',
            label: 'Customer Name',
            sortable: true
        },
        {
            key: 'area',
            label: 'Area',
            sortable: true,
        },
        {
            key: 'salesEngineerId',
            label: 'Sales Engineer',
            sortable: true,
            render: (value, item) => item.sales_engineer?.fullName ?? '-'
        },
        {
            key: 'salesManagerId',
            label: 'Sales Manager',
            sortable: true,
            render: (value, item) => item.sales_manager?.fullName ?? '-'
        },
        {
            key: 'financeManagerId',
            label: 'Finance Manager',
            sortable: true,
            render: (value, item) => item.finance_manager?.fullName ?? '-'
        },
        {
            key: 'marketingManagerId',
            label: 'Marketing Manager',
            sortable: true,
            render: (value, item) => item.marketing_manager?.fullName ?? '-'
        },
        {
            key: 'customerServiceManagerId',
            label: 'CS Manager',
            sortable: true,
            render: (value, item) => item.customer_service_manager?.fullName ?? '-'
        },
        {
            key: 'isActive',
            label: 'Activo',
            sortable: true,
            render: (value) => value ? 'Activo' : 'Inactivo'
        }
    ];

    acciones: AccionPersonalizada<Customer>[] = [
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

    resetPassword(user: Customer) {
        console.log('Reset', user.customerName);
    }

    toggleUser(user: Customer) {
        console.log('Toggle', user.customerName);
    }

    constructor(
        private _customerService: CustomerService
    ) { }

    ngOnInit(): void {
        this.getUsers();
    }

    getUsers(): void {
        this._customerService.getCustomers().subscribe({
            next: (response) => {
                this.customers.set(response);
                console.log('✅ Usuarios cargados:', response);
            },
            error: (error) => {
                console.error('❌ Error al cargar usuarios:', error);
            }
        });
    }

}
