import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SlotPage } from './slot.page';

describe('SlotPage', () => {
  let component: SlotPage;
  let fixture: ComponentFixture<SlotPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SlotPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
