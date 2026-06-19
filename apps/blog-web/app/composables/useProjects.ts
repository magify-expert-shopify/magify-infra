import type { Project, ProjectMember } from "~/types/projects";

export function useProjects() {
  const { request } = useApi();

  function useProjectsList() {
    return useAsyncData("projects", () => request<Project[]>("/projects"));
  }

  function useProjectMembers(projectId: MaybeRefOrGetter<string | null | undefined>) {
    return useAsyncData(
      computed(() => {
        const value = toValue(projectId)?.trim();
        return value ? `project-members:${value}` : "project-members:empty";
      }),
      async () => {
        const value = toValue(projectId)?.trim();

        if (!value) {
          return [];
        }

        return await request<ProjectMember[]>(`/projects/${value}/members`);
      },
      {
        watch: [projectId],
      },
    );
  }

  async function createProject(input: {
    name: string;
    description?: string | null;
    shopifyStoreDomain?: string | null;
  }) {
    return await request<Project>("/projects", {
      method: "POST",
      body: input,
    });
  }

  async function joinProject(input: { slug: string }) {
    return await request<Project>("/projects/join", {
      method: "POST",
      body: input,
    });
  }

  async function deleteProject(projectId: string) {
    return await request<{ deleted: boolean }>(`/projects/${projectId}`, {
      method: "DELETE",
    });
  }

  async function updateProject(
    projectId: string,
    input: {
      name?: string | null;
      description?: string | null;
      shopifyStoreDomain?: string | null;
    },
  ) {
    return await request<Project>(`/projects/${projectId}`, {
      method: "PATCH",
      body: input,
    });
  }

  return {
    useProjectsList,
    useProjectMembers,
    createProject,
    joinProject,
    deleteProject,
    updateProject,
  };
}
