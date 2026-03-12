import { Component, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AccordeonContainer } from "../../../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";
import { RoleService } from '../../../../core/services/role-service';
import { Role } from '../../../../data/interfaces/User';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ClassificationTypeGroup, WorkflowService } from '../../../../core/services/workflow-service';
import { forkJoin, map } from 'rxjs';
import { RolesManageModal } from './components/roles-manage-modal/roles-manage-modal';
import { RoleFormModal } from './components/role-form-modal/role-form-modal';
import { AddStepModal } from './components/add-step-modal/add-step-modal';
import { AddWorkflowModal } from './components/add-workflow-modal/add-workflow-modal';
import { Workflow } from '../../../../data/interfaces/Workflow';
import { Spinner } from '../../../../shared/components/ui/spinner/spinner';

interface Color {
  name: string;
  value: string;
}

interface WorkflowStep {
  id: number;
  stepNumber: number;
  roleId: number;
  isFinalStep: boolean;
  roleName: string;
  description: string;
  action: string;
  icon: string;
  cardClass: string;
  badgeClass: string;
  cardBorderColor?: string;
  cardBgColor?: string;
  iconColor?: string;
  badgeColor?: string;
  badgeBgColor?: string;
  badgeBorderColor?: string;
}

interface WorkflowGroup {
  id: number;
  title: string;
  description: string;
  type: string;
  requestTypeName?: string;
  steps: WorkflowStep[];
}

interface AdvanceCondition {
  id: number;
}

interface BranchRule {
  id: number;
}

@Component({
  selector: 'app-workflows',
  imports: [TranslatePipe, AccordeonContainer, AccordeonItem, LucideAngularModule, RolesManageModal, RoleFormModal, AddStepModal, AddWorkflowModal, Spinner],
  templateUrl: './workflows.html',
  styleUrl: './workflows.css'
})
export class Workflows {

  public isOpenModal = signal<boolean>(false);
  public isOpenRoleModal = signal<boolean>(false);
  public isOpenAddStepModal = signal<boolean>(false);
  public isOpenAddWorkflowModal = signal<boolean>(false);
  public isStepNumberLocked = signal<boolean>(false);
  public editingStepId = signal<number | null>(null);
  public isLoadingWorkflows = signal<boolean>(true);
  public isLoadingStepModal = signal<boolean>(false);
  public isSavingStep = signal<boolean>(false);
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

  public classificationTypes = signal<ClassificationTypeGroup[]>([])

  public permissionsOptions = [
    'Aprobar',
    'Rechazar',
    'Corregir',
    'Cancelar'
  ];

  public conditionComparators = ['Es igual a', 'Contiene'];
  public branchComparators = ['Mayor que', 'Igual que'];

  public workflowsMock = signal<WorkflowGroup[]>([]);
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

  public availableRoles = computed(() => {
    return this.roles().length > 0 ? this.roles() : this.defaultRoles;
  });

  public availableStepsForJump = computed(() => {
    const active = this.activeWorkflow();
    if (!active) {
      return [];
    }

    return active.steps.map((step) => ({
      label: `Paso ${step.stepNumber} - ${step.roleName}`,
      value: String(step.stepNumber)
    }));
  });

  public ROLE_COLORS: Color[] = [
    { name: "Rojo", value: "#EF4444" },
    { name: "Rosa", value: "#EC4899" },
    { name: "Fucsia", value: "#D946EF" },
    { name: "Naranja", value: "#F97316" },
    { name: "Ambar", value: "#F59E0B" },
    { name: "Amarillo", value: "#EAB308" },
    { name: "Lima", value: "#84CC16" },
    { name: "Verde", value: "#22C55E" },
    { name: "Esmeralda", value: "#10B981" },
    { name: "Turquesa", value: "#14B8A6" },
    { name: "Cian", value: "#06B6D4" },
    { name: "Celeste", value: "#0EA5E9" },
    { name: "Azul", value: "#3B82F6" },
    { name: "Indigo", value: "#6366F1" },
    { name: "Slate", value: "#64748B" },
    { name: "Grafito", value: "#374151" }
  ]

  public selectedItem: Color = { name: "", value: "" };

  constructor(
    private _roleService: RoleService,
    private _workflowService: WorkflowService
  ) {
    this.getWorkflows();
  }

  private getWorkflows() {
    this.isLoadingWorkflows.set(true);
    this._workflowService.getWorkflows().subscribe({
      next: (response) => {
        const mappedWorkflows = response.map((workflow) => {
          const sortedSteps = [...(workflow.steps ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);

          return {
            id: workflow.id ?? 0,
            title: workflow.name,
            description: workflow.request_type?.name ? `${workflow.description} - ${workflow.request_type.name}` : workflow.description,
            type: workflow.classificationType ?? '',
            requestTypeName: workflow.request_type?.name,
            steps: sortedSteps.map((step) => {
              const action = step.isInitialStep ? 'Inicio' : step.isFinalStep ? 'Finalización' : 'Aprobación';
              const roleColor = step.role?.color;

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
                badgeBorderColor: roleColor
              };
            })
          } as WorkflowGroup;
        });

        this.workflowsMock.set(mappedWorkflows);
        this.isLoadingWorkflows.set(false);
      },
      error: (error) => {
        console.log(error);
        this.isLoadingWorkflows.set(false);
      }
    });
  }

  private getStepIcon(action: string): string {
    switch (action) {
      case 'Inicio':
        return 'play';
      case 'Finalización':
        return 'check';
      default:
        return 'shield-check';
    }
  }

  private getStepCardClass(action: string): string {
    switch (action) {
      case 'Inicio':
        return 'h-40 border-orange-200 bg-orange-50';
      case 'Finalización':
        return 'h-40 border-emerald-300 bg-emerald-50';
      default:
        return 'h-40 border-blue-300 bg-blue-50';
    }
  }

  private getStepBadgeClass(action: string): string {
    switch (action) {
      case 'Inicio':
        return 'border bg-orange-100 text-orange-700';
      case 'Finalización':
        return 'border bg-emerald-100 text-emerald-700';
      default:
        return 'border bg-blue-100 text-blue-700';
    }
  }

  private hexToRgba(hexColor?: string, alpha: number = 1): string | undefined {
    if (!hexColor) {
      return undefined;
    }

    const normalized = hexColor.replace('#', '');
    const isShort = normalized.length === 3;
    const fullHex = isShort
      ? normalized.split('').map((char) => char + char).join('')
      : normalized;

    if (fullHex.length !== 6) {
      return undefined;
    }

    const r = Number.parseInt(fullHex.slice(0, 2), 16);
    const g = Number.parseInt(fullHex.slice(2, 4), 16);
    const b = Number.parseInt(fullHex.slice(4, 6), 16);

    if ([r, g, b].some((value) => Number.isNaN(value))) {
      return undefined;
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private loadModalData(workflowId: number) {
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

  private getWorkflowSteps(workflowId: number) {
    this._workflowService.getWorkflowSteps(workflowId).subscribe({
      next: (response) => {
        this.workflowSteps.set(response);
      },
      error: (error) => {
        console.log(error);
      }
    });
  }

  private getRoles() {
    this._roleService.getRoles().subscribe({
      next: (response) => {
        // console.log(response);
        this.isLoadingRoles.set(false);
        this.roles.set(response);
        console.log(this.roles());
      },
      error: (error) => {
        this.isLoadingRoles.set(false);
        console.log(error);
      }
    })
  }

  private getClassificationTypesS() {
    this._workflowService.getClassificationTypes().pipe(
      map((items: ClassificationTypeGroup[]) => items.filter((item) => item.type !== null)),
    ).subscribe({
      next: (response) => {
        console.log(response);
        this.classificationTypes.set(response);
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  public showModal(isOpen: boolean) {
    this.isOpenModal.set(isOpen);
  }
  public showRoleModal(isOpen: boolean) {
    this.isOpenRoleModal.set(isOpen);
  }

  public openModal() {
    this.showModal(true);
    this.isLoadingRoles.set(true);
    this.getRoles();
  }

  public openAddStepModal(workflow: WorkflowGroup) {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(false);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();
    this.stepForm.controls.stepOrder.enable();
    const lastStep = workflow.steps.length > 0 ? Math.max(...workflow.steps.map(s => s.stepNumber)) : 0;
    this.stepForm.controls.stepOrder.setValue(lastStep + 1);
    this.loadModalData(workflow.id);
  }

  public openEditStepModal(workflow: WorkflowGroup, step: WorkflowStep) {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(false);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();
    this.editingStepId.set(step.id);
    this.stepForm.controls.stepOrder.enable();
    this.stepForm.patchValue({
      stepOrder: step.stepNumber,
      roleId: step.roleId,
      isFinalStep: step.isFinalStep
    });
    this.loadModalData(workflow.id);
  }

  public openAddStepModalFromConnector(workflow: WorkflowGroup, currentStepNumber: number) {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(true);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();
    this.stepForm.controls.stepOrder.setValue(currentStepNumber + 1);
    this.stepForm.controls.stepOrder.disable();
    this.loadModalData(workflow.id);
  }

  public showAddStepModal(isOpen: boolean) {
    this.isOpenAddStepModal.set(isOpen);

    if (!isOpen) {
      this.resetStepModalData();
    }
  }

  public openAddWorkflowModal() {
    this.getClassificationTypesS();
    this.isOpenAddWorkflowModal.set(true);
    this.workflowForm.reset({ name: '', description: '', requestTypeId: 0, classificationType: '' });
  }

  public showAddWorkflowModal(isOpen: boolean) {
    this.isOpenAddWorkflowModal.set(isOpen);
  }

  public addAdvanceCondition() {
    const next = this.nextConditionId++;
    this.advanceConditions.update((items) => [...items, { id: next }]);
  }

  public removeAdvanceCondition(id: number) {
    this.advanceConditions.update((items) => items.filter((item) => item.id !== id));
  }

  public addBranchRule() {
    const next = this.nextBranchRuleId++;
    this.branchRules.update((items) => [...items, { id: next }]);
  }

  public removeBranchRule(id: number) {
    this.branchRules.update((items) => items.filter((item) => item.id !== id));
  }

  public saveStep() {
    this.submitted.set(true);

    if (this.stepForm.invalid) {
      this.stepForm.markAllAsTouched();
      return;
    }

    const activeWorkflow = this.activeWorkflow();
    if (!activeWorkflow) {
      return;
    }

    const formValue = this.stepForm.getRawValue();
    const selectedRole = this.availableRoles().find(r => r.id === formValue.roleId);
    
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
      next: (response) => {
        console.log(response);
        this.isSavingStep.set(false);
        this.isOpenAddStepModal.set(false);
        this.resetStepModalData();
        this.getWorkflows();
      },
      error: (error) => {
        console.log(error);
        this.isSavingStep.set(false);
      }
    });
  }

  public saveWorkflow() {
    this.workflowForm.markAllAsTouched();

    if (this.workflowForm.invalid) {
      return;
    }

    const formValue = this.workflowForm.getRawValue();
    console.log(formValue);
    const object: Workflow = {
      name: formValue.name,
      description: formValue.description,
      requestTypeId: formValue.requestTypeId,
      classificationType: formValue.classificationType
    };

    console.log(object);
    this.isOpenAddWorkflowModal.set(false);
    this._workflowService.storeClassification(object).subscribe({
      next: (response) => {
        console.log(response);
        this.getWorkflows();
      },
      error: (error) => {
        console.log(error);
      }
    })
  }

  onSelectColor(item: Color): void {
    this.selectedItem = item;
  }

  public saveRole() {
    console.log("Si jala");
    this.isOpenRoleModal.set(true);
  }

  private resetStepModalData() {
    this.submitted.set(false);
    this.editingStepId.set(null);
    this.stepForm.reset({
      workflowId: null,
      stepOrder: null,
      roleId: null,
      isFinalStep: false
    });
    this.stepForm.controls.stepOrder.enable();
    this.isStepNumberLocked.set(false);
    this.transitions.set([]);
    this.advanceConditions.set([]);
    this.branchRules.set([]);
    this.nextConditionId = 1;
    this.nextBranchRuleId = 1;
  }

}
