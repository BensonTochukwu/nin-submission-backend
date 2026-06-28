export enum AllowedState {
  LAGOS = 'LAGOS',
  ONDO = 'ONDO',
}

export const ALLOWED_STATE_LABELS: Record<AllowedState, string> = {
  [AllowedState.LAGOS]: 'Lagos',
  [AllowedState.ONDO]: 'Ondo',
};

export function getEnabledStates(form: { lagosEnabled: boolean; ondoEnabled: boolean }) {
  return [
    form.lagosEnabled ? AllowedState.LAGOS : null,
    form.ondoEnabled ? AllowedState.ONDO : null,
  ].filter((state): state is AllowedState => state !== null);
}

export function getEnabledStateOptions(form: { lagosEnabled: boolean; ondoEnabled: boolean }) {
  return getEnabledStates(form).map((value) => ({
    label: ALLOWED_STATE_LABELS[value],
    value,
  }));
}
