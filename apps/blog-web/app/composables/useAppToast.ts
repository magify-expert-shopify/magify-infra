export function useAppToast() {
  const toast = useToast();

  function showToast(options: {
    title: string;
    description?: string;
    color?: "success" | "error" | "warning" | "info" | "primary" | "neutral";
    icon?: string;
  }) {
    toast.add({
      title: options.title,
      description: options.description,
      color: options.color ?? "neutral",
      icon: options.icon,
    });
  }

  function showSuccessToast(title: string, description?: string) {
    showToast({
      title,
      description,
      color: "success",
      icon: "i-lucide-circle-check-big",
    });
  }

  function showWarningToast(title: string, description?: string) {
    showToast({
      title,
      description,
      color: "warning",
      icon: "i-lucide-triangle-alert",
    });
  }

  function showErrorToast(title: string, description?: string) {
    showToast({
      title,
      description,
      color: "error",
      icon: "i-lucide-circle-alert",
    });
  }

  function showInfoToast(title: string, description?: string) {
    showToast({
      title,
      description,
      color: "info",
      icon: "i-lucide-info",
    });
  }

  return {
    showErrorToast,
    showInfoToast,
    showSuccessToast,
    showToast,
    showWarningToast,
  };
}
