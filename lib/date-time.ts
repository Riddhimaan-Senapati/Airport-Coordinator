const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

export function parseLocalDateTime(value: unknown) {
  if (typeof value !== "string") return null;
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondText] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText) - 1,
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
    second: Number(secondText ?? 0),
    millisecond: Number((millisecondText ?? "0").padEnd(3, "0")),
  };
  const date = new Date(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  const roundTrips =
    date.getFullYear() === parts.year &&
    date.getMonth() === parts.month &&
    date.getDate() === parts.day &&
    date.getHours() === parts.hour &&
    date.getMinutes() === parts.minute &&
    date.getSeconds() === parts.second &&
    date.getMilliseconds() === parts.millisecond;

  return roundTrips ? date : null;
}

export function localDateTimeToUtc(value: unknown) {
  return parseLocalDateTime(value)?.toISOString() ?? null;
}

export function utcToLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => part.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
