import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BatchFinishedMessage, ReverbSocketService } from '../../core/services/reverb-socket-service';
import { ToastService } from '../../core/services/toast-service';

@Component({
    selector: 'app-notifications',
    templateUrl: './notifications.html',
    styleUrl: './notifications.css',
    imports: [CommonModule, ReactiveFormsModule],
})
export class Notifications implements OnInit, OnDestroy {
    private readonly socketService = inject(ReverbSocketService);
    private readonly toastService = inject(ToastService);
    private messageSubscription: Subscription | null = null;
    private batchFinishedSubscription: Subscription | null = null;

    readonly messages = this.socketService.messages;
    readonly lastMessage = this.socketService.lastMessage;
    readonly connectionState = this.socketService.connectionState;
    readonly connectionError = this.socketService.connectionError;
    readonly sending = signal<boolean>(false);
    readonly lastBatchFinished = signal<BatchFinishedMessage | null>(null);

    readonly broadcastForm = new FormGroup({
        message: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        bearerToken: new FormControl<string>('', { nonNullable: true }),
    });

    ngOnInit(): void {
        this.connect();
        this.messageSubscription = this.socketService.messages$.subscribe((incomingMessage) => {
            console.info('[Notifications Component] message received:', incomingMessage);
        });

        this.batchFinishedSubscription = this.socketService.batchFinished$.subscribe((batchMessage) => {
            this.lastBatchFinished.set(batchMessage);
            this.notifyBatchFinished(batchMessage);
        });
    }

    ngOnDestroy(): void {
        this.messageSubscription?.unsubscribe();
        this.batchFinishedSubscription?.unsubscribe();
        this.socketService.disconnect();
    }

    connect(): void {
        this.socketService.connectToGlobalNotifications();
    }

    disconnect(): void {
        this.socketService.disconnect();
    }

    sendBroadcast(): void {
        if (this.broadcastForm.invalid) {
            this.broadcastForm.markAllAsTouched();
            return;
        }

        const message = this.broadcastForm.controls.message.value.trim();
        const bearerToken = this.broadcastForm.controls.bearerToken.value.trim();

        
        this.sending.set(true);
        this.socketService.emitBroadcast(
            { message, title: 'Hola', type: 'info' },
            bearerToken.length > 0 ? bearerToken : undefined
        ).subscribe({
            next: () => {
                this.sending.set(false);
                this.broadcastForm.controls.message.setValue('');
                console.info('[Notifications Component] broadcast request completed successfully.');
            },
            error: (error) => {
                this.sending.set(false);
                console.error('[Notifications Component] broadcast request failed:', error);
            }
        });
    }

    private notifyBatchFinished(batchMessage: BatchFinishedMessage): void {
        const batch = batchMessage.batch;
        const batchId = batch?.id ?? 'N/A';
        const status = String(batch?.status ?? '').toLowerCase();
        const errorRecords = Number(batch?.errorRecords ?? 0);

        if (status === 'failed' || errorRecords > 0) {
            this.toastService.error(
                `Batch ${batchId} finalizo con errores (${errorRecords} registros con error).`,
                batchMessage.title ?? 'Batch procesado con errores'
            );
            console.warn('[Notifications Component] Batch finished with errors:', batchMessage);
            return;
        }

        this.toastService.success(
            `Batch ${batchId} finalizo correctamente.`,
            batchMessage.title ?? 'Batch completado'
        );
        console.info('[Notifications Component] Batch finished successfully:', batchMessage);
    }

}
