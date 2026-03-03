import { Component, computed, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { AccordeonContainer } from "../../../../shared/components/ui/accordeon/accordeon-container";
import { AccordeonItem } from "../../../../shared/components/ui/accordeon/accordeon-item";
import { LucideAngularModule } from "lucide-angular";
import { Modal } from "../../../../shared/components/ui/modal/modal";
import { RoleService } from '../../../../core/services/role-service';
import { Role } from '../../../../data/interfaces/User';
import { Spinner } from "../../../../shared/components/ui/spinner/spinner";
import { TitleCasePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

interface Color {
  name: string;
  value: string;
}

interface WorkflowStep {
  stepNumber: number;
  roleName: string;
  description: string;
  action: string;
  icon: string;
  cardClass: string;
  badgeClass: string;
}

interface WorkflowGroup {
  id: number;
  title: string;
  description: string;
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
  imports: [TranslatePipe, AccordeonContainer, AccordeonItem, LucideAngularModule, Modal, Spinner, TitleCasePipe, ReactiveFormsModule],
  templateUrl: './workflows.html',
  styleUrl: './workflows.css'
})
export class Workflows {

  public isOpenModal = signal<boolean>(false);
  public isOpenRoleModal = signal<boolean>(false);
  public isOpenAddStepModal = signal<boolean>(false);
  public isOpenAddWorkflowModal = signal<boolean>(false);
  public isStepNumberLocked = signal<boolean>(false);
  public roles = signal<Role[]>([]);
  public isLoadingRoles = signal<boolean>(true);
  public submitted = signal(false);
  public form = new FormGroup({
    roleName: new FormControl<string>('', Validators.required)
  });
  public stepForm = new FormGroup({
    stepNumber: new FormControl<number | null>(null, Validators.required),
    roleId: new FormControl<number | null>(null, Validators.required),
    permissions: new FormControl<string | null>(null, Validators.required),
    description: new FormControl<string>('', Validators.required)
  });

  public workflowForm = new FormGroup({
    title: new FormControl<string>('', Validators.required),
    description: new FormControl<string>('', Validators.required)
  });

  public permissionsOptions = [
    'Aprobar',
    'Rechazar',
    'Corregir',
    'Cancelar'
  ];

  public conditionComparators = ['Es igual a', 'Contiene'];
  public branchComparators = ['Mayor que', 'Igual que'];

  public workflowsMock = signal<WorkflowGroup[]>([
    {
      id: 1,
      title: 'Flujo principal - Nota de crédito',
      description: 'Proceso lineal con aprobación en cadena para notas de crédito',
      steps: [
        { stepNumber: 1, roleName: 'Requester', description: 'Crea la nota', action: 'Creación', icon: 'user', cardClass: 'border-orange-200 bg-orange-50', badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200' },
        { stepNumber: 2, roleName: 'Processor', description: 'Procesa y valida', action: 'Procesamiento', icon: 'settings', cardClass: 'border-slate-300 bg-slate-50', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300' },
        { stepNumber: 3, roleName: 'CS Leader', description: 'Aprueba la nota', action: 'Aprobación', icon: 'shield-check', cardClass: 'border-blue-300 bg-blue-50', badgeClass: 'bg-blue-100 text-blue-700 border border-blue-300' },
        { stepNumber: 4, roleName: 'Manager', description: 'Aprobación gerencial', action: 'Aprobación', icon: 'clipboard-check', cardClass: 'border-blue-300 bg-blue-50', badgeClass: 'bg-blue-100 text-blue-700 border border-blue-300' },
        { stepNumber: 5, roleName: 'Released', description: 'Nota liberada', action: 'Liberación', icon: 'check', cardClass: 'border-emerald-300 bg-emerald-50', badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-300' }
      ]
    },
    {
      id: 2,
      title: 'Flujo alterno - Nota de débito',
      description: 'Proceso lineal con aprobación en cadena para notas de débito',
      steps: [
        { stepNumber: 1, roleName: 'Requester', description: 'Crea la nota', action: 'Creación', icon: 'user', cardClass: 'border-orange-200 bg-orange-50', badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200' },
        { stepNumber: 2, roleName: 'Finance', description: 'Procesamiento financiero', action: 'Procesamiento', icon: 'building-2', cardClass: 'border-slate-300 bg-slate-50', badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300' },
        { stepNumber: 3, roleName: 'Approve', description: 'Aprobación final', action: 'Aprobación', icon: 'shield-check', cardClass: 'border-blue-300 bg-blue-50', badgeClass: 'bg-blue-100 text-blue-700 border border-blue-300' }
      ]
    }
  ]);

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
    private _roleService: RoleService
  ) {

  }

  private getRoles() {
    this._roleService.getRoles().subscribe({
      next: (response) => {
        this.isLoadingRoles.set(false);
        this.roles.set(response);
      },
      error: (error) => {
        this.isLoadingRoles.set(false);
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
    this.stepForm.controls.stepNumber.enable();
  }

  public openAddStepModalFromConnector(workflow: WorkflowGroup, currentStepNumber: number) {
    this.activeWorkflow.set(workflow);
    this.isStepNumberLocked.set(true);
    this.isOpenAddStepModal.set(true);
    this.resetStepModalData();

    const nextStep = currentStepNumber + 1;
    this.stepForm.controls.stepNumber.setValue(nextStep);
    this.stepForm.controls.stepNumber.disable();
  }

  public showAddStepModal(isOpen: boolean) {
    this.isOpenAddStepModal.set(isOpen);

    if (!isOpen) {
      this.resetStepModalData();
    }
  }

  public openAddWorkflowModal() {
    this.isOpenAddWorkflowModal.set(true);
    this.workflowForm.reset({ title: '', description: '' });
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

    this.isOpenAddStepModal.set(false);
    this.resetStepModalData();
  }

  public saveWorkflow() {
    this.workflowForm.markAllAsTouched();
    this.isOpenAddWorkflowModal.set(false);
  }

  onSelectColor(item: Color): void {
    this.selectedItem = item;
  }

  public saveRole() {
    console.log("Si jala");
    this.isOpenRoleModal.set(true);
  }

  public onPermissionsChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.stepForm.controls.permissions.setValue(target.value);
    this.stepForm.controls.permissions.markAsTouched();
  }

  campoVacio(controlName: string): boolean {
    const control = this.form.get(controlName);
    if (!control) return false;
    return control.invalid && (control.touched || this.submitted());
  }

  getErrorMessage(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }

    return 'Valor no válido';
  }

  private resetStepModalData() {
    this.submitted.set(false);
    this.stepForm.reset({
      stepNumber: null,
      roleId: null,
      permissions: null,
      description: ''
    });
    this.stepForm.controls.stepNumber.enable();
    this.isStepNumberLocked.set(false);
    this.advanceConditions.set([]);
    this.branchRules.set([]);
    this.nextConditionId = 1;
    this.nextBranchRuleId = 1;
  }

}
