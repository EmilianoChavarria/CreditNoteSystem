import { Component, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AccordeonContainer } from '../../../../shared/components/ui/accordeon/accordeon-container';
import { AccordeonItem } from '../../../../shared/components/ui/accordeon/accordeon-item';
import { RoleService } from '../../../../core/services/role-service';
import { Role } from '../../../../data/interfaces/User';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ClassificationTypeGroup, WorkflowService } from '../../../../core/services/workflow-service';
import { forkJoin, map } from 'rxjs';
import { RolesManageModal } from './components/roles-manage-modal/roles-manage-modal';
import { RoleFormModal } from './components/role-form-modal/role-form-modal';
import { AddStepModal } from './components/add-step-modal/add-step-modal';
import { AddWorkflowModal } from './components/add-workflow-modal/add-workflow-modal';
import { WorkflowStepList, AddStepBetweenEvent, EditStepEvent } from './components/workflow-step-list/workflow-step-list';
import { Workflow } from '../../../../data/interfaces/Workflow';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';
import { ToastService } from '../../../../core/services/toast-service';
import { Modal as UiModal } from '../../../../shared/components/ui/modal/modal';
import { ApiResponse } from '../../../../data/interfaces/ApiResponse-interface';
import { Color, WorkflowGroup, WorkflowStep, WorkflowTransition } from './workflows.types';

interface AdvanceCondition { id: number; }
interface BranchRule { id: number; }

@Component({
  selector: 'app-workflows',
  imports: [TranslatePipe, AccordeonContainer, AccordeonItem, RolesManageModal, RoleFormModal, AddStepModal, AddWorkflowModal, WorkflowStepList, Spinner, UiModal],
  templateUrl: './workflows.html',
  styleUrl: './workflows.css'
})
export class Workflows {

  public isOpenModal = signal<boolean>(false);
  public isOpenRoleModal = signal<boolean>(false);
  public isOpenAddStepModal = signal<boolean>(false);
  public isOpenAddWorkflowModal = signal<boolean>(false);
  public isOpenDeleteStepConfirmModal = signal<boolean>(false);
  public isStepNumberLocked = signal<boolean>(false);
  public editingStepId = signal<number | null>(null);
  public isLoadingWorkflows = signal<boolean>(true);
  public isLoadingStepModal = signal<boolean>(false);
  public isSavingStep = signal<boolean>(false);
  public deletingStepIds = signal<Set<number>>(new Set<number>());
  public stepPendingDeletion = signal<WorkflowStep | null>(null);
  public roles = signal<Role[]>([]);
  public isLoadingRoles = signal<boolean>(true);
  public submitted = signal(false);

  public form = new FormGroup({
    roleName: new FormControl<string>('', Validators.required)
  });

  public stepForm = new FormGroup({
    workflowId: new FormControl<number | null>(null),
    stepOrder: new FormControl<number | null>(null, Validators.required),
    roleId: new FormControl<number | null>(null, Validators.required),
    isFinalStep: new FormControl<boolean>(false)
  });

  public transitions = signal<any[]>([]);

  public workflowForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    requestTypeId: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    classificationType: new FormControl('', { nonNullable: true })
  });

  public classificationTypes = signal<ClassificationTypeGroup[]>([]);
  public workflowsMock = signal<WorkflowGroup[]>([]);
  public workflowStepsMap = signal<Map<number, WorkflowStep[]>>(new Map());
  public workflowSteps = signal<any[]>([]);
  public activeWorkflow = signal<WorkflowGroup | null>(null);

  public advanceConditions = signal<AdvanceCondition[]>([]);
  public branchRules = signal<BranchRule[]>([]);
  private nextConditionId = 1;
  private nextBranchRuleId = 1;

  private defaultRoles: Role[] = [
    { id: 1, roleName: 'Requester', color: '#F97316' },
    { id: 2, roleName: 'Processor', color: '#64748B' },
    { id: 3, roleName: 'Manager', color: '#3B82F6' },
    { id: 4, roleName: 'Finance', color: '#6366F1' }
  ];

  public availableRoles = computed(() =>
    this.roles().length > 0 ? this.roles() : this.defaultRoles
  );

  public availableStepsForJump = computed(() => {
    const active = this.activeWorkflow();
    if (!active) return [];
    const steps = this.workflowStepsMap().get(active.id) ?? active.steps;
    return steps.map((step) => ({
      label: `Paso ${step.stepNumber} - ${step.roleName}`,
      value: String(step.stepNumber)
    }));
  });

  public selectedItem: Color = { name: '', value: '' };

  public ROLE_COLORS: Color[] = [
    { name: 'Rojo', value: '#EF4444' },
    { name: 'Rosa', value: '#EC4899' },
    { name: 'Fucsia', value: '#D946EF' },
    { name: 'Naranja', value: '#F97316' },
    { name: 'Ambar', value: '#F59E0B' },
    { name: 'Amarillo', value: '#EAB308' },
    { name: 'Lima', value: '#84CC16' },
    { name: 'Verde', value: '#22C55E' },
    { name: 'Esmeralda', value: '#10B981' },
    { name: 'Turquesa', value: '#14B8A6' },
    { name: 'Cian', value: '#06B6D4' },
    { name: 'Celeste', value: '#0EA5E9' },
    { name: 'Azul', value: '#3B82F6' },
    { name: 'Indigo', value: '#6366F1' },
    { name: 'Slate', value: '#64748B' },
    { name: 'Grafito', value: '#374151' }
  ];

  constructor(
    private _roleService: RoleService,
    private _workflowService: WorkflowService,
    private _toastService: ToastService
  ) {
    this.getWorkflows();
  }

  // ─── Step mapping helpers ──────────────────────────────────────────────────

  private mapRawSteps(rawSteps: any[]): WorkflowStep[] {
    return [...rawSteps]
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((step) => {
        const action = step.isInitialStep ? 'Inicio' : step.isFinalStep ? 'Finalización' : 'Aprobación';
        const roleColor = step.role?.color;
        const outgoingTransitions = ((step as any).outgoingTransitions ?? (step as any).outgoing_transitions ?? [])
          .map((t: any, i: number) => ({
            id: t.id,
            toStepId: t.toStepId ?? t.to_step?.id ?? null,
            conditionField: t.conditionField ?? '',
            conditionOperator: t.conditionOperator ?? '',
            conditionValue: t.conditionValue ?? '',
            priority: t.priority ?? i + 1
          }))
          .sort((a: WorkflowTransition, b: WorkflowTransition) => a.priority - b.priority);

        return {
          id: step.id,
          stepNumber: step.stepOrder,
          roleId: step.role?.id ?? step.roleId,
          isFinalStep: step.isFinalStep,
          roleName: step.role?.roleName ?? step.stepName,
          description: step.stepName,
          action,
          icon: this.getStepIcon(action),
          cardClass: this.getStepCardClass(action),
          badgeClass: this.getStepBadgeClass(action),
          cardBorderColor: roleColor,
          cardBgColor: this.hexToRgba(roleColor, 0.1),
          iconColor: roleColor,
          badgeColor: roleColor,
          badgeBgColor: this.hexToRgba(roleColor, 0.12),
          badgeBorderColor: roleColor,
          outgoingTransitions
        } as WorkflowStep;
      });
  }

  private getStepIcon(action: string): string {
    if (action === 'Inicio') return 'play';
    if (action === 'Finalización') return 'check';
    return 'shield-check';
  }

  private getStepCardClass(action: string): string {
    if (action === 'Inicio') return 'h-40 border-orange-200 bg-orange-50';
    if (action === 'Finalización') return 'h-40 border-emerald-300 bg-emerald-50';
    return 'h-40 border-blue-300 bg-blue-50';
  }

  private getStepBadgeClass(action: string): string {
    if (action === 'Inicio') return 'border bg-orange-100 text-orange-700';
    if (action === 'Finalización') return 'border bg-emerald-100 text-emerald-700';
    return 'border bg-blue-100 text-blue-700';
  }

  private hexToRgba(hexColor?: string, alpha = 1): string | undefined {
    if (!hexColor) return undefined;
    const normalized = hexColor.replace('#', '');
    const fullHex = normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
    if (fullHex.length !== 6) return undefined;
    const r = parseInt(fullHex.slice(0, 2), 16);
    const g = parseInt(fullHex.slice(2, 4), 16);
    const b = parseInt(fullHex.slice(4, 6), 16);
    if ([r, g, b].some(isNaN)) return undefined;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  private getWorkflows(): void {
    this.isLoadingWorkflows.set(true);
    this._workflowService.getWorkflows().subscribe({
      next: (response) => {
        const mappedWorkflows = response.map((wf) => ({
          id: wf.id ?? 0,
          title: wf.name,
          description: wf.request_type?.name
            ? `${wf.description} - ${wf.request_type.name}`
            : wf.description,
          type: wf.classificationType ?? '',
          requestTypeName: wf.request_type?.name,
          steps: this.mapRawSteps(wf.steps ?? [])
        } as WorkflowGroup));

        const stepsMap = new Map<number, WorkflowStep[]>();
        mappedWorkflows.forEach((w) => stepsMap.set(w.id, w.steps));
        this.workflowStepsMap.set(stepsMap);
        this.workflowsMock.set(mappedWorkflows);
        this.isLoadingWorkflows.set(false);
      },
      error: (error) => {
        console.log(error);
        this.isLoadingWorkflows.set(false);
      }
    });
  }

  private refreshWorkflowSteps(workflowId: number): void {
    this._workflowService.getWorkflowSteps(workflowId).subscribe({
      next: (rawSteps) => {
        const mappedSteps = this.mapRawSteps(rawSteps);
        this.workflowStepsMap.update((map) => {
          const next = new Map(map);
          next.set(workflowId, mappedSteps);
          return next;
        });
      },
      error: (error) => console.log(error)
    });
  }

  private loadModalData(workflowId: number): void {
    this.isLoadingStepModal.set(true);
    forkJoin({
      roles: this._roleService.getRoles(),
      steps: this._workflowService.getWorkflowSteps(workflowId)
    }).subscribe({
      next: ({ roles, steps }) => {
        this.isLoadingRoles.set(false);
        this.roles.set(roles);
        this.workflowSteps.set(steps);
        this.isLoadingStepModal.set(false);
      },
      error: (error) => {
        console.log(error);
        this.isLoadingStepModal.set(false);
      }
    });
  }

  private getRoles(): void {
    this._roleService.getRoles().subscribe({
      next: (response) => {
        this.isLoadingRoles.set(false);
        this.roles.set(response);
      },
      error: (error) => {
        this.isLoadingRoles.set(false);
        console.log(error);
      }
    });
  }

  private getClassificationTypesS(): void {
    this._workflowService.getClassificationTypes().pipe(
      map((items: ClassificationTypeGroup[]) => items.filter((item) => item.type !== null))
    ).subscribe({
      next: (response) => this.classificationTypes.set(response),
      error: (error) => console.log(error)
    });
  }

  // ─── Modal handlers ────────────────────────────────────────────────────────

  public showModal(isOpen: boolean): void { this.isOpenModal.set(isOpen); }
  public showRoleModal(isOpen: boolean): void { this.isOpenRoleModal.set(isOpen); }
  public showAddStepModal(isOpen: boolean): void {
    this.isOpenAddStepModal.set(isOpen);
    if (!isOpen) this.resetStepModalData();
  }
  public showAddWorkflowModal(isOpen: boolean): void { this.isOpenAddWorkflowModal.set(isOpen); }

  public openModal(): void {
    this.showModal(true);
    this.isLoadingRoles.set(true);
    this.getRoles();
  }

  public openRoleModal(): void { this.isOpenRoleModal.set(true); }

  public openAddWorkflowModal(): void {
    this.getClassificationTypesS();
    this.isOpenAddWorkflowModal.set(true);
    this.workflowForm.reset({ name: '', description: '', requestTypeId: 0, classificationType: '' });
  }

  // ─── Step list event handlers (from WorkflowStepList) ─────────────────────

  public onAddStep(workflow: WorkflowGroup): void {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(false);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();
    this.stepForm.controls.stepOrder.enable();
    const steps = this.workflowStepsMap().get(workflow.id) ?? workflow.steps;
    const lastStep = steps.length > 0 ? Math.max(...steps.map((s) => s.stepNumber)) : 0;
    this.stepForm.controls.stepOrder.setValue(lastStep + 1);
    this.loadModalData(workflow.id);
  }

  public onAddStepBetween({ workflow, stepNumber }: AddStepBetweenEvent): void {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(true);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();
    this.stepForm.controls.stepOrder.setValue(stepNumber + 1);
    this.stepForm.controls.stepOrder.disable();
    this.loadModalData(workflow.id);
  }

  public onEditStep({ workflow, step }: EditStepEvent): void {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(true);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();
    this.editingStepId.set(step.id);
    this.stepForm.controls.stepOrder.disable();
    this.stepForm.patchValue({ stepOrder: step.stepNumber, roleId: step.roleId, isFinalStep: step.isFinalStep });
    this.transitions.set(step.outgoingTransitions ?? []);
    this.loadModalData(workflow.id);
  }

  public onDeleteStep({ workflow, step }: EditStepEvent): void {
    this.activeWorkflow.set(workflow);
    this.stepPendingDeletion.set(step);
    this.isOpenDeleteStepConfirmModal.set(true);
  }

  // ─── CRUD operations ───────────────────────────────────────────────────────

  public saveStep(): void {
    this.submitted.set(true);
    if (this.stepForm.invalid) { this.stepForm.markAllAsTouched(); return; }

    const activeWorkflow = this.activeWorkflow();
    if (!activeWorkflow) return;

    const formValue = this.stepForm.getRawValue();
    const selectedRole = this.availableRoles().find((r) => r.id === formValue.roleId);

    const stepPayload: any = {
      workflowId: activeWorkflow.id,
      stepName: selectedRole?.roleName || '',
      stepOrder: formValue.stepOrder,
      roleId: formValue.roleId,
      isFinalStep: formValue.isFinalStep
    };

    if (this.transitions().length > 0) {
      stepPayload.transitions = this.transitions();
    }

    this.isSavingStep.set(true);
    const editId = this.editingStepId();
    const request$ = editId !== null
      ? this._workflowService.updateWorkflowStep(editId, stepPayload)
      : this._workflowService.storeWorkflowStep(stepPayload);

    request$.subscribe({
      next: (response: ApiResponse<any>) => {
        this._toastService.success(
          response.message ?? `Paso ${editId !== null ? 'actualizado' : 'creado'} correctamente.`,
          'Éxito'
        );
        this.isSavingStep.set(false);
        this.isOpenAddStepModal.set(false);
        this.resetStepModalData();
        this.refreshWorkflowSteps(activeWorkflow.id);
      },
      error: (error) => {
        console.log(error);
        this.isSavingStep.set(false);
      }
    });
  }

  public showDeleteStepConfirmModal(isOpen: boolean): void {
    this.isOpenDeleteStepConfirmModal.set(isOpen);
    if (!isOpen) this.stepPendingDeletion.set(null);
  }

  public confirmDeleteStep(): void {
    const step = this.stepPendingDeletion();
    if (!step) return;

    if (!step.id) {
      this._toastService.error('No se pudo identificar el paso a eliminar.', 'Error');
      this.showDeleteStepConfirmModal(false);
      return;
    }

    this.showDeleteStepConfirmModal(false);
    const workflowId = this.activeWorkflow()?.id;

    this.deletingStepIds.update((ids) => { const s = new Set(ids); s.add(step.id); return s; });

    this._workflowService.deleteWorkflowStep(step.id).subscribe({
      next: (response) => {
        this._toastService.success(response.message ?? 'Paso eliminado correctamente.', 'Éxito');
        if (workflowId) this.refreshWorkflowSteps(workflowId);
        else this.getWorkflows();
        this.deletingStepIds.update((ids) => { const s = new Set(ids); s.delete(step.id); return s; });
      },
      error: (error) => {
        this._toastService.error(error?.error?.message ?? 'No se pudo eliminar el paso.', 'Error');
        this.deletingStepIds.update((ids) => { const s = new Set(ids); s.delete(step.id); return s; });
      }
    });
  }

  public saveWorkflow(): void {
    this.workflowForm.markAllAsTouched();
    if (this.workflowForm.invalid) return;

    const formValue = this.workflowForm.getRawValue();
    const object: Workflow = {
      name: formValue.name,
      description: formValue.description,
      requestTypeId: formValue.requestTypeId,
      classificationType: formValue.classificationType
    };

    this.isOpenAddWorkflowModal.set(false);
    this._workflowService.storeClassification(object).subscribe({
      next: () => this.getWorkflows(),
      error: (error) => console.log(error)
    });
  }

  public saveRole(): void {
    const data = { color: this.selectedItem.value, roleName: this.form.value.roleName?.toUpperCase() } as Role;
    this._roleService.saveRole(data).subscribe({
      next: (response) => {
        this._toastService.success(response.message || '', 'Éxito');
        this.isOpenRoleModal.set(false);
        this.getRoles();
      },
      error: (error) => console.log(error)
    });
  }

  public onSelectColor(item: Color): void { this.selectedItem = item; }

  public addAdvanceCondition(): void {
    this.advanceConditions.update((items) => [...items, { id: this.nextConditionId++ }]);
  }
  public removeAdvanceCondition(id: number): void {
    this.advanceConditions.update((items) => items.filter((item) => item.id !== id));
  }
  public addBranchRule(): void {
    this.branchRules.update((items) => [...items, { id: this.nextBranchRuleId++ }]);
  }
  public removeBranchRule(id: number): void {
    this.branchRules.update((items) => items.filter((item) => item.id !== id));
  }

  private resetStepModalData(): void {
    this.submitted.set(false);
    this.editingStepId.set(null);
    this.stepForm.reset({ workflowId: null, stepOrder: null, roleId: null, isFinalStep: false });
    this.stepForm.controls.stepOrder.enable();
    this.isStepNumberLocked.set(false);
    this.transitions.set([]);
    this.advanceConditions.set([]);
    this.branchRules.set([]);
    this.nextConditionId = 1;
    this.nextBranchRuleId = 1;
  }
}
