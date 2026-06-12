import { inject, signal } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Request, RequestType } from '../../data/interfaces/Request';
import { Role } from '../../data/interfaces/User';
import { WorkflowDetail } from '../../features/history/components/workflow-history-drawer/workflow-history-drawer';
import { PermissionAction, RequestTypePermissionRecord } from '../../core/services/role-service';
import { RequestService } from '../../core/services/request-service';
import {
    buildRequestWorkflowDetailFromHistory,
    buildRequestWorkflowDetailFromRequest,
    WorkflowDetailLabels,
} from '../utils/request-workflow-utils';

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
    public roleFilterOptions = signal<{ label: string; value: string }[]>([]);
    public selectedRoleName = signal<string>('all');
    public showHistoryDrawer = signal<boolean>(false);
    public showHistoryModal = signal<boolean>(false);
    public workflowDetail: WorkflowDetail | null = null;
    public selectedRequest = signal<Request | null>(null);
    public submitted = signal(false);
    public showDeclineModal = signal<boolean>(false);
    public showInfoModal = signal<boolean>(false);
    public selectedRequestForInfo = signal<Request | null>(null);
    public canDeleteInfoAttachments = signal<boolean>(false);
    protected readonly requestTypeActionPermissions = signal<Record<number, Record<string, boolean>>>({});
    public selectedRequesterId = signal<string>('all');
    public requesterOptions = signal<{ label: string; value: string }[]>([]);
    public selectedClassificationType = signal<string>('all');
    public classificationTypeOptions = signal<{ label: string; value: string }[]>([]);
    public selectedDateFrom = signal<string>('');
    public selectedDateTo = signal<string>('');
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
            statusCancelled: this._translateService.instant(`${p}.STATUS_CANCELLED`),
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

    openInfoModal(request: Request): void {
        const requestTypeId = Number(request.requestTypeId ?? request.requestType?.id);
        const canDelete = this.hasRequestTypePermission(requestTypeId, [
            'delete_attachments', 'delete_attachment', 'delete_atachments', 'delete_atachment'
        ]);
        this.canDeleteInfoAttachments.set(canDelete);
        this.selectedRequestForInfo.set(request);
        this.showInfoModal.set(true);
    }

    onInfoModalChange(isOpen: boolean): void {
        this.showInfoModal.set(isOpen);
        if (!isOpen) {
            this.selectedRequestForInfo.set(null);
            this.canDeleteInfoAttachments.set(false);
        }
    }

    closeHistoryDrawer(): void {
        this.showHistoryDrawer.set(false);
    }

    closeHistoryModal(): void {
        this.showHistoryModal.set(false);
    }

    onInfoModalViewHistory(): void {
        const request = this.selectedRequestForInfo();
        if (!request) return;
        this.openHistoryModal(request);
    }

    openHistoryModal(request: Request): void {
        this.showHistoryModal.set(false);
        this.workflowDetail = null;
        const labels = this.getWorkflowLabels();

        if (!request.id) {
            this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, labels);
            setTimeout(() => this.showHistoryModal.set(true));
            return;
        }

        this._requestsService.getRequestHistory(request.id).subscribe({
            next: (response) => {
                this.workflowDetail = response
                    ? buildRequestWorkflowDetailFromHistory(response, labels)
                    : buildRequestWorkflowDetailFromRequest(request, labels);
                setTimeout(() => this.showHistoryModal.set(true));
            },
            error: () => {
                this.workflowDetail = buildRequestWorkflowDetailFromRequest(request, labels);
                setTimeout(() => this.showHistoryModal.set(true));
            }
        });
    }

    logAction(request: Request): void {
        this.openHistoryDrawer(request);
    }

    generatePdf(request: Request): void {
        if (!request.id) return;
        this._requestsService.getRequestPdf(request.id).subscribe({
            next: (blob) => {
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            },
        });
    }

    editRequest(request: Request, returnTo?: string): void {
        const requestTypeId = Number(request.requestTypeId ?? request.requestType?.id);
        if (!requestTypeId || Number.isNaN(requestTypeId)) return;
        this._router.navigate(['/app/request/new-request'], {
            queryParams: { requestTypeId },
            state: { editRequest: request, returnTo }
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

    onRoleFilterChange(roleName: string): void {
        const normalizedRoleName = roleName?.trim() || 'all';
        if (normalizedRoleName === this.selectedRoleName()) return;

        this.selectedRoleName.set(normalizedRoleName);
        this.resetPagination();

        if (this.selectedRequestType !== 'DE' && this.selectedRequestType) {
            this.loadRequests();
        }
    }

    protected loadRequesterOptions(requestTypeId: number): void {
        this._requestsService.getRequesters(requestTypeId).subscribe({
            next: (requesters) => {
                this.requesterOptions.set(
                    requesters.map((r) => ({ label: r.fullName.toUpperCase(), value: String(r.id) }))
                );
            },
            error: () => this.requesterOptions.set([])
        });
    }

    onRequesterFilterChange(value: string): void {
        const normalized = value?.trim() || 'all';
        if (normalized === this.selectedRequesterId()) return;
        this.selectedRequesterId.set(normalized);
        this.resetPagination();
        if (this.selectedRequestType !== 'DE' && this.selectedRequestType) {
            this.loadRequests();
        }
    }

    onClassificationTypeFilterChange(value: string): void {
        const normalized = value?.trim() || 'all';
        if (normalized === this.selectedClassificationType()) return;
        this.selectedClassificationType.set(normalized);
        this.resetPagination();
        if (this.selectedRequestType !== 'DE' && this.selectedRequestType) {
            this.loadRequests();
        }
    }

    onDateRangeChange({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }): void {
        this.selectedDateFrom.set(dateFrom);
        this.selectedDateTo.set(dateTo);
        this.resetPagination();
        if (this.selectedRequestType !== 'DE' && this.selectedRequestType) {
            this.loadRequests();
        }
    }

    protected getDateRangeParams(): { dateFrom?: string; dateTo?: string } {
        const result: { dateFrom?: string; dateTo?: string } = {};
        const from = this.selectedDateFrom();
        const to = this.selectedDateTo();
        if (from) result.dateFrom = from;
        if (to) result.dateTo = to;
        return result;
    }

    protected setRoleFilterOptions(roles: Role[]): void {
        this.roleFilterOptions.set(
            roles
                .map((role) => (role.roleName ?? '').trim())
                .filter((roleName) => roleName.length > 0)
                .map((roleName) => ({
                    label: roleName,
                    value: roleName,
                }))
        );
    }
}
