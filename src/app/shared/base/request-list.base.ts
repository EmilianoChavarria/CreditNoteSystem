import { inject, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { Request, RequestType } from '../../data/interfaces/Request';
import { WorkflowDetail } from '../../features/history/components/workflow-history-drawer/workflow-history-drawer';
import { PermissionAction, RequestTypePermissionRecord } from '../../core/services/role-service';
import { RequestService } from '../../core/services/request-service';
import {
    buildRequestPdfDefinition,
    buildRequestWorkflowDetailFromHistory,
    buildRequestWorkflowDetailFromRequest,
    WorkflowDetailLabels,
} from '../utils/request-workflow-utils';

const pdf: any = (pdfMake as any).default ?? pdfMake;
pdf.vfs = (pdfFonts as any).default?.vfs ?? (pdfFonts as any).vfs;

export abstract class RequestListBase {
    protected abstract getI18nPrefix(): string;
    protected abstract loadRequests(): void;

    protected readonly _translateService = inject(TranslateService);
    protected readonly _requestsService = inject(RequestService);
    protected readonly _router = inject(Router);

    protected form!: FormGroup;

    public selectedRequestType: string = '';
    public availableRequestTypes = signal<RequestType[]>([]);
    public requests = signal<Request[]>([]);
    public pageSize = signal<number>(10);
    public currentPage = signal<number>(1);
    public totalPages = signal<number>(1);
    public hasNextPage = signal<boolean>(false);
    public hasPrevPage = signal<boolean>(false);
    public isLoadingTable = signal<boolean>(true);
    public isLoading = signal<boolean>(false);
    public searchTerm = signal<string>('');
    public showHistoryDrawer = signal<boolean>(false);
    public workflowDetail: WorkflowDetail | null = null;
    public selectedRequest = signal<Request | null>(null);
    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);
    protected readonly requestTypeActionPermissions = signal<Record<number, Record<string, boolean>>>({});
    protected currentLanguage = signal<string>(this._translateService.currentLang || 'es');
    protected searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

    protected subscribeToLanguageChanges(): void {
        this._translateService.onLangChange.subscribe((langChangeEvent) => {
            this.currentLanguage.set(langChangeEvent.lang);
            if (this.showHistoryDrawer() && this.selectedRequest()) {
                this.openHistoryDrawer(this.selectedRequest()!);
            }
        });
    }

    protected getWorkflowLabels(): WorkflowDetailLabels {
        this.currentLanguage();
        const p = this.getI18nPrefix();
        return {
            noClient: this._translateService.instant(`${p}.NO_CLIENT`),
            noClassification: this._translateService.instant(`${p}.NO_CLASSIFICATION`),
            flowLabel: this._translateService.instant(`${p}.FLOW_LABEL`),
            stepLabel: this._translateService.instant(`${p}.STEP`),
            progressText: (current, total) => this._translateService.instant(`${p}.STEP_OF`, { current, total }),
            noComments: this._translateService.instant(`${p}.NO_COMMENTS`),
            noStatus: this._translateService.instant(`${p}.NO_STATUS`),
            statusCreated: this._translateService.instant(`${p}.STATUS_CREATED`),
            statusProcessed: this._translateService.instant(`${p}.STATUS_PROCESSED`),
            statusRejected: this._translateService.instant(`${p}.STATUS_REJECTED`),
            statusReturned: this._translateService.instant(`${p}.STATUS_RETURNED`),
            statusApproved: this._translateService.instant(`${p}.STATUS_APPROVED`),
            statusPending: this._translateService.instant(`${p}.STATUS_PENDING`),
        };
    }

    protected buildRequestTypeActionPermissions(
        actions: PermissionAction[],
        permissions: RequestTypePermissionRecord[]
    ): Record<number, Record<string, boolean>> {
        const actionSlugById = actions.reduce<Record<number, string>>((acc, action) => {
            acc[action.id] = action.slug?.trim().toLowerCase() ?? '';
            return acc;
        }, {});

        const permissionMatrix: Record<number, Record<string, boolean>> = {};

        for (const permission of permissions) {
            const slug = actionSlugById[permission.action_id];
            if (!slug) continue;
            if (!permissionMatrix[permission.request_type_id]) {
                permissionMatrix[permission.request_type_id] = {};
            }
            permissionMatrix[permission.request_type_id][slug] = Boolean(permission.is_allowed);
        }

        return permissionMatrix;
    }

    protected hasRequestTypePermission(requestTypeId: number, slugCandidates: string[]): boolean {
        if (!requestTypeId || Number.isNaN(requestTypeId)) return false;
        const permissionsBySlug = this.requestTypeActionPermissions()[requestTypeId] ?? {};
        return slugCandidates.some((slug) => Boolean(permissionsBySlug[slug]));
    }

    protected resetPagination(): void {
        this.currentPage.set(1);
        this.totalPages.set(1);
        this.hasNextPage.set(false);
        this.hasPrevPage.set(false);
    }

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }

    logAction(request: Request): void {
        this.openHistoryDrawer(request);
    }

    generatePdf(request: Request): void {
        const docDefinition = buildRequestPdfDefinition(request);
        (pdf as { createPdf: (definition: Record<string, unknown>) => { open: () => void } }).createPdf(docDefinition).open();
    }

    editRequest(request: Request): void {
        const requestTypeId = Number(request.requestTypeId ?? request.requestType?.id);
        if (!requestTypeId || Number.isNaN(requestTypeId)) return;
        this._router.navigate(['/app/request/new-request'], {
            queryParams: { requestTypeId },
            state: { editRequest: request }
        });
    }

    openHistoryDrawer(request: Request): void {
        this.selectedRequest.set(request);
        this.showHistoryDrawer.set(false);
        this.workflowDetail = null;
        const labels = this.getWorkflowLabels();

        if (!request.id) {
            this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, labels);
            setTimeout(() => this.showHistoryDrawer.set(true));
            return;
        }

        this._requestsService.getRequestHistory(request.id).subscribe({
            next: (response) => {
                this.workflowDetail = response
                    ? buildRequestWorkflowDetailFromHistory(response, labels)
                    : buildRequestWorkflowDetailFromRequest(request, labels);
                setTimeout(() => this.showHistoryDrawer.set(true));
            },
            error: () => {
                this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, labels);
                setTimeout(() => this.showHistoryDrawer.set(true));
            }
        });
    }

    campoVacio(controlName: string): boolean {
        const control = this.form.get(controlName);
        if (!control) return false;
        return control.invalid && (control.touched || this.submitted());
    }

    getErrorMessage(controlName: string): string {
        const control = this.form.get(controlName);
        if (!control || !control.errors) return '';
        const p = this.getI18nPrefix();
        if (control.errors['required']) return this._translateService.instant(`${p}.REQUIRED_FIELD`);
        return this._translateService.instant(`${p}.INVALID_VALUE`);
    }

    onNextPage(): void {
        if (!this.hasNextPage()) return;
        this.currentPage.update((value) => value + 1);
        this.loadRequests();
    }

    onPrevPage(): void {
        if (!this.hasPrevPage()) return;
        this.currentPage.update((value) => Math.max(1, value - 1));
        this.loadRequests();
    }

    onFirstPage(): void {
        if (this.currentPage() === 1) return;
        this.currentPage.set(1);
        this.loadRequests();
    }

    onLastPage(): void {
        if (this.currentPage() === this.totalPages()) return;
        this.currentPage.set(this.totalPages());
        this.loadRequests();
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.resetPagination();
        if (this.selectedRequestType !== 'DE') {
            this.loadRequests();
        }
    }

    onSearch(term: string): void {
        if (this.selectedRequestType === 'DE' || !this.selectedRequestType) return;
        if (this.searchDebounceTimeout) clearTimeout(this.searchDebounceTimeout);
        this.searchDebounceTimeout = setTimeout(() => {
            const normalizedTerm = term.trim();
            if (normalizedTerm === this.searchTerm()) return;
            this.searchTerm.set(normalizedTerm);
            this.resetPagination();
            this.loadRequests();
        }, 350);
    }
}
