import type { Project } from "~/types/projects";
import {
  CURRENT_PROJECT_COOKIE,
  CURRENT_PROJECT_STATE_KEY,
} from "~/constants/current-project";

export function useCurrentProject() {
  const projectCookie = useCookie<Project | null>(CURRENT_PROJECT_COOKIE, {
    sameSite: "lax",
    path: "/",
    default: () => null,
  });

  const currentProject = useState<Project | null>(
    CURRENT_PROJECT_STATE_KEY,
    () => projectCookie.value,
  );

  watch(
    currentProject,
    (value) => {
      projectCookie.value = value;
    },
    { deep: true },
  );

  function setCurrentProject(project: Project | null) {
    currentProject.value = project;
  }

  function clearCurrentProject() {
    currentProject.value = null;
  }

  return {
    currentProject,
    setCurrentProject,
    clearCurrentProject,
  };
}
