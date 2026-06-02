import {Component, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import {CommonModule} from "@angular/common";
import {IonButton, IonContent, IonIcon, IonToggle} from "@ionic/angular/standalone";
import {FormsModule} from "@angular/forms";
import {PageHeaderComponent} from "../page-header/page-header.component";
import {addIcons} from "ionicons";
import {add, createOutline, ellipse, square, trashOutline, triangle, timeOutline, informationCircleOutline} from "ionicons/icons";
import {EspDaySchedule, EspPlanning, EspSlot, SlotPayload} from "../core/model/application.model";
import {ThermostatService} from "../core/service/thermostat-service";

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  imports: [IonContent, PageHeaderComponent, FormsModule, CommonModule, IonIcon, IonButton]
})
export class Tab2Page implements OnInit {

  constructor(private router: Router, private readonly thermostatService: ThermostatService ) {
    addIcons({ triangle, ellipse, square, add, createOutline, trashOutline, timeOutline, informationCircleOutline });
  }

  selectedDay = 1;

  days = [
    { label: 'Lun', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Mer', value: 3 },
    { label: 'Jeu', value: 4 },
    { label: 'Ven', value: 5 },
    { label: 'Sam', value: 6 },
    { label: 'Dim', value: 0 },
  ];

  planning: EspPlanning | null = null;

  ngOnInit() {
    this.thermostatService.planning$.subscribe(planning => {
      this.planning = planning;
    })
  }

  ionViewWillEnter(): void {
    const payload = history.state?.['slotPayload'] as SlotPayload | undefined;

    console.log(payload);

    if (payload) {
      this.applySlotPayload(payload);
      if (this.planning) {
        this.thermostatService.syncSchedule(this.planning);
      }
      history.replaceState({}, '');
    }

    this.normalizePlanning();

  }

  get currentDay(): EspDaySchedule | undefined {
    return this.planning?.days.find(day => day.dayOfWeek === this.selectedDay);
  }

  get daySlots(): EspSlot[] {
    const day = this.currentDay;
    if (!day) {
      return [];
    }

    return this.sortSlots(day.slots);
  }

  openCreatePage(): void {
    this.router.navigate(['/tabs/tab2/slot'], {
      state: {
        slotFormData: {
          mode: 'create',
          dayOfWeek: this.selectedDay,
          index: null,
          slot: {
            start: '12:00',
            temperature: 20,
          },
        },
      },
    });
  }

  openEditPage(index: number): void {
    const slot = this.daySlots[index];
    if (!slot) {
      return;
    }

    this.router.navigate(['/tabs/tab2/slot'], {
      state: {
        slotFormData: {
          mode: 'edit',
          dayOfWeek: this.selectedDay,
          index,
          slot: {
            start: slot.start,
            temperature: slot.temperature,
          },
        },
      },
    });
  }

  deleteSlot(index: number): void {
    const day = this.currentDay;
    if (!day) {
      return;
    }

    const sortedSlots = this.sortSlots(day.slots);
    const slotToDelete = sortedSlots[index];

    if (!slotToDelete) {
      return;
    }

    if (!this.canDeleteSlot(index)) {
      return;
    }

    const nextSlots = sortedSlots.filter((_, i) => i !== index);

    if (!this.validateDay({ ...day, slots: nextSlots })) {
      return;
    }

    day.slots = nextSlots;

    if (this.planning) {
      this.thermostatService.syncSchedule(this.planning);
    }
  }

  canDeleteSlot(index: number): boolean {
    const slots = this.daySlots;
    const slot = slots[index];

    if (!slot) {
      return false;
    }

    if (slots.length <= 1) {
      return false;
    }

    return slot.start !== '00:00';
  }

  formatHour(time: string): string {
    if (!time) {
      return '00:00';
    }

    const [h = '0', m = '0'] = time.split(':');

    const hours = Math.min(Math.max(Number(h), 0), 23)
      .toString()
      .padStart(2, '0');

    const minutes = Math.min(Math.max(Number(m), 0), 59)
      .toString()
      .padStart(2, '0');

    return `${hours}:${minutes}`;
  }

  getSlotEnd(index: number): string {
    const slots = this.daySlots;
    const nextSlot = slots[index + 1];

    return nextSlot ? this.formatHour(nextSlot.start) : '23:59';
  }

  getTempClass(temp: number): string {
    if (temp <= 18) {
      return 'cold';
    }

    if (temp < 21) {
      return 'warm';
    }

    return 'hot';
  }

  trackBySlot(_index: number, slot: EspSlot): string {
    return `${slot.start}-${slot.temperature}`;
  }

  copyDayScheduleToWeek(slots: EspSlot[]): void {
    if (!this.planning) {
      return;
    }

    this.planning = this.copyDayScheduleToWeekPlanning(this.planning, slots);
    this.thermostatService.syncSchedule(this.planning);
  }

  private copyDayScheduleToWeekPlanning(
    planning: EspPlanning,
    slots: EspSlot[]
  ): EspPlanning {
    const normalizedSlots = this.sortSlots(slots).map((slot) => ({
      start: this.formatHour(slot.start),
      temperature: Number(slot.temperature),
    }));

    return {
      ...planning,
      days: planning.days.map((day) => ({
        ...day,
        slots: [...normalizedSlots],
      })),
    };
  }

  private applySlotPayload(payload: SlotPayload): void {
    if (!this.planning) {
      return;
    }

    const day = this.planning.days.find((d) => d.dayOfWeek === payload.dayOfWeek);
    if (!day) {
      return;
    }

    const normalizedSlot: EspSlot = {
      start: this.formatHour(payload.slot.start),
      temperature: Number(payload.slot.temperature),
    };

    if (!this.isValidHour(normalizedSlot.start)) {
      return;
    }

    if (!this.isValidTemperature(normalizedSlot.temperature)) {
      return;
    }

    const nextSlots = this.sortSlots([...day.slots]);

    if (payload.mode === 'create') {
      const exists = nextSlots.some((slot) => slot.start === normalizedSlot.start);
      if (exists) {
        return;
      }

      nextSlots.push(normalizedSlot);
    } else {
      if (
        payload.index === null ||
        payload.index < 0 ||
        payload.index >= nextSlots.length
      ) {
        return;
      }

      const originalSlot = nextSlots[payload.index];
      if (!originalSlot) {
        return;
      }

      if (originalSlot.start === '00:00' && normalizedSlot.start !== '00:00') {
        return;
      }

      const duplicateIndex = nextSlots.findIndex(
        (slot, index) =>
          slot.start === normalizedSlot.start && index !== payload.index
      );

      if (duplicateIndex !== -1) {
        return;
      }

      nextSlots[payload.index] = normalizedSlot;
    }

    const sortedSlots = this.sortSlots(nextSlots);

    const nextDay = {
      ...day,
      slots: sortedSlots,
    };

    if (!this.validateDay(nextDay)) {
      return;
    }

    this.planning = {
      ...this.planning,
      days: this.planning.days.map((d) =>
        d.dayOfWeek === payload.dayOfWeek ? nextDay : d
      ),
    };

    console.log(this.planning);

    this.selectedDay = payload.dayOfWeek;
  }

  private normalizePlanning(): void {
    if (!this.planning) {
      return;
    }

    this.planning = {
      ...this.planning,
      days: this.planning.days.map((day) => {
        const normalizedSlots = this.sortSlots(
          day.slots
            .map((slot) => ({
              start: this.formatHour(slot.start),
              temperature: Number(slot.temperature),
            }))
            .filter(
              (slot) =>
                this.isValidHour(slot.start) &&
                this.isValidTemperature(slot.temperature)
            )
        );

        if (!normalizedSlots.length || normalizedSlots[0].start !== '00:00') {
          normalizedSlots.unshift({
            start: '00:00',
            temperature: normalizedSlots[0]?.temperature ?? 20,
          });
        }

        const uniqueSlots = normalizedSlots.filter(
          (slot, index, array) =>
            index === array.findIndex((item) => item.start === slot.start)
        );

        return {
          ...day,
          slots: uniqueSlots,
        };
      }),
    };
  }

  private validateDay(day: EspDaySchedule): boolean {
    const sorted = this.sortSlots(day.slots);

    if (!sorted.length) {
      return false;
    }

    if (sorted[0].start !== '00:00') {
      return false;
    }

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      if (!this.isValidHour(current.start)) {
        return false;
      }

      if (!this.isValidTemperature(current.temperature)) {
        return false;
      }

      if (i > 0) {
        const previous = sorted[i - 1];

        if (this.hourToMinutes(previous.start) >= this.hourToMinutes(current.start)) {
          return false;
        }
      }
    }

    return true;
  }

  private sortSlots(slots: EspSlot[]): EspSlot[] {
    return [...slots]
      .map(slot => ({
        start: this.formatHour(slot.start),
        temperature: Number(slot.temperature),
      }))
      .sort(
        (a, b) => this.hourToMinutes(a.start) - this.hourToMinutes(b.start)
      );
  }

  private hourToMinutes(time: string): number {
    const normalized = this.formatHour(time);
    const [h, m] = normalized.split(':').map(Number);
    return h * 60 + m;
  }

  private isValidHour(time: string): boolean {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
  }

  private isValidTemperature(temp: number): boolean {
    return !Number.isNaN(temp);
  }

}
