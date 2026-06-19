export function isDataForSeoQuotaError(error: unknown) {
  const candidateMessages: string[] = [];

  if (error instanceof Error) {
    candidateMessages.push(error.message);
  }

  if (typeof error === "string") {
    candidateMessages.push(error);
  }

  if (error && typeof error === "object") {
    const errorObject = error as Record<string, unknown>;

    if (typeof errorObject.message === "string") {
      candidateMessages.push(errorObject.message);
    }

    if (typeof errorObject.statusCode === "number") {
      candidateMessages.push(`status ${errorObject.statusCode}`);
    }

    if (typeof errorObject.status === "number") {
      candidateMessages.push(`status ${errorObject.status}`);
    }

    if (typeof errorObject.data === "string") {
      candidateMessages.push(errorObject.data);
    }

    if (errorObject.data && typeof errorObject.data === "object") {
      candidateMessages.push(JSON.stringify(errorObject.data));
    }
  }

  const normalizedMessage = candidateMessages.join(" ").toLowerCase();

  return (
    normalizedMessage.includes("402") &&
    (normalizedMessage.includes("dataforseo") ||
      normalizedMessage.includes("quota") ||
      normalizedMessage.includes("request failed with status 402") ||
      normalizedMessage.includes("status 402"))
  );
}
