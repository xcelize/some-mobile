export interface EspSlot {
  start: string;
  temperature: number;
}

export interface EspDaySchedule {
  dayOfWeek: number;
  slots: EspSlot[];
}

export interface EspPlanning {
  days: EspDaySchedule[];
}

export interface SlotPayload {
  mode: 'create' | 'edit';
  dayOfWeek: number;
  index: number | null;
  slot: EspSlot;
}

export interface EspDeviceState {
  temperature: number;
  target: number;
  enabled: boolean;
  relay: boolean;
  temperatureOffset: number;
  mode: 'MANUAL' | 'OFF' | 'AUTO';
  online: boolean;
  lastSeenAt: string | null;
  firmwareVersion: string | null;
}

export interface DeviceStatusResponse {
  temperature: number | null;
  target: number | null;
  enabled: boolean;
  relay: boolean;
  temperatureOffset: number | null;
  mode: 'MANUAL' | 'OFF' | 'AUTO';
  online: boolean;
  lastSeenAt: string | null;
  firmwareVersion: string | null;
}

export interface DeviceCommandResult {
  deviceId: string;
  externalId: string;
  requestId: string;
  commandType: 'MODE' | 'TARGET_TEMPERATURE' | 'OFFSET' | 'SCHEDULE' | 'FIRMWARE';
  accepted: boolean;
  message: string;
}

export interface DeviceCommandNotification {
  deviceId: string;
  requestId: string;
  commandType: 'MODE' | 'TARGET_TEMPERATURE' | 'OFFSET' | 'SCHEDULE' | 'FIRMWARE';
  status: 'PENDING' | 'PUBLISHED' | 'APPLIED' | 'FAILED';
  applied: boolean;
  errorMessage: string | null;
  acknowledgedAt: string | null;
}

export interface DeviceTelemetryResponse {
  temperature: number | null;
  targetTemperature: number | null;
  relay: boolean;
  enabled: boolean;
  mode: 'MANUAL' | 'OFF' | 'AUTO';
  recordedAt: string;
}

export interface DeviceConsumptionResponse {
  electricalPowerKw: number | null;
  relayOnSeconds: number;
  relayActivityPercent: number;
  energyKwh: number | null;
}

export interface DeviceTelemetryBucketResponse {
  bucketStart: string;
  bucketEnd: string;
  averageTemperature: number | null;
  minimumTemperature: number | null;
  maximumTemperature: number | null;
  relayActivityPercent: number;
}

export interface DeviceSuggestionResponse {
  code: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  title: string;
  message: string;
}

export interface DeviceAlertResponse {
  type: 'OFFLINE' | 'OVERHEATING' | 'LOW_TEMPERATURE' | 'HEATING_INEFFICIENT' | 'RAPID_COOLING';
  severity: 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  createdAt: string;
  lastDetectedAt: string;
}

export interface DeviceThermalMetricsResponse {
  coolingRateCelsiusPerHour: number | null;
  heatingMinutesPerDegree: number | null;
  latestOutdoorTemperature: number | null;
  analyzedCoolingMinutes: number;
  analyzedHeatingMinutes: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}
