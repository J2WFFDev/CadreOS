"use client";

import { useEffect, useMemo, useState } from "react";

type ProgramOption = {
  id: string;
  name: string;
};

type TeamOption = {
  id: string;
  name: string;
  program: ProgramOption;
};

type ScopeOption = {
  value: string;
  label: string;
};

type RoleOption = {
  value: string;
  label: string;
};

export function MemberRoleAssignmentForm(props: {
  action: string;
  programs: ProgramOption[];
  teams: TeamOption[];
  defaultRoleType: string;
  defaultScopeType: string;
  defaultProgramId: string;
  defaultTeamId: string;
  scopeOptions: ScopeOption[];
  roleOptionsByScope: Record<string, RoleOption[]>;
  roleTypeError?: string;
  scopeTypeError?: string;
  programIdError?: string;
  teamIdError?: string;
}) {
  const [scopeType, setScopeType] = useState(props.defaultScopeType);
  const [programId, setProgramId] = useState(props.defaultProgramId);
  const [teamId, setTeamId] = useState(props.defaultTeamId);
  const [roleType, setRoleType] = useState(props.defaultRoleType);

  const filteredTeams = useMemo(
    () => (programId ? props.teams.filter((team) => team.program.id === programId) : []),
    [programId, props.teams],
  );
  const roleOptions = props.roleOptionsByScope[scopeType] ?? [];

  useEffect(() => {
    if (!roleOptions.some((option) => option.value === roleType)) {
      setRoleType(roleOptions[0]?.value ?? "");
    }
  }, [roleOptions, roleType]);

  useEffect(() => {
    if (!filteredTeams.some((team) => team.id === teamId)) {
      setTeamId("");
    }
  }, [filteredTeams, teamId]);

  useEffect(() => {
    if (scopeType === "PROGRAM") {
      setTeamId("");
    }
  }, [scopeType]);

  return (
    <form action={props.action} method="post" className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="scopeType" className="text-sm font-medium">
          Assignment scope
        </label>
        <select
          id="scopeType"
          name="scopeType"
          value={scopeType}
          onChange={(event) => setScopeType(event.currentTarget.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {props.scopeOptions.map((scopeOption) => (
            <option key={scopeOption.value} value={scopeOption.value}>
              {scopeOption.label}
            </option>
          ))}
        </select>
        {props.scopeTypeError ? <p className="text-sm text-red-600">{props.scopeTypeError}</p> : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {scopeType === "PROGRAM"
            ? "Program-scope assignment grants role access at the program level."
            : "Team-scope assignment grants role access only for the selected team."}
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="programId" className="text-sm font-medium">
          Program
        </label>
        <select
          id="programId"
          name="programId"
          value={programId}
          onChange={(event) => setProgramId(event.currentTarget.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Select a program</option>
          {props.programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.name}
            </option>
          ))}
        </select>
        {props.programIdError ? <p className="text-sm text-red-600">{props.programIdError}</p> : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="teamId" className="text-sm font-medium">
          Team
        </label>
        <select
          id="teamId"
          name="teamId"
          value={teamId}
          onChange={(event) => setTeamId(event.currentTarget.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          disabled={scopeType === "PROGRAM" || programId.length === 0}
        >
          <option value="">{programId ? "Select a team" : "Select a program first"}</option>
          {filteredTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        {props.teamIdError ? <p className="text-sm text-red-600">{props.teamIdError}</p> : null}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Teams are filtered to the selected program.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="roleType" className="text-sm font-medium">
          Role type
        </label>
        <select
          id="roleType"
          name="roleType"
          value={roleType}
          onChange={(event) => setRoleType(event.currentTarget.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
        >
          {roleOptions.map((roleOption) => (
            <option key={roleOption.value} value={roleOption.value}>
              {roleOption.label}
            </option>
          ))}
        </select>
        {props.roleTypeError ? <p className="text-sm text-red-600">{props.roleTypeError}</p> : null}
      </div>

      <button type="submit" className="rounded-md bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black">
        Assign role
      </button>
    </form>
  );
}
