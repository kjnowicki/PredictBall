import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TopNavigation } from './top-navigation';

describe('TopNavigation', () => {
  let component: TopNavigation;
  let fixture: ComponentFixture<TopNavigation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TopNavigation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TopNavigation);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
