import { PILOT_RULES } from "../lib/pilotCopy";

export default function TournamentRules() {
  return <ul>{PILOT_RULES.map(rule => <li key={rule}>{rule}</li>)}</ul>;
}
