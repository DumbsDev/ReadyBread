export const getDeviceId = (): string => {
  const KEY = "rb_device_id";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && (crypto as Crypto).randomUUID
          ? (crypto as Crypto).randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36);

      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
};
