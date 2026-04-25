# Skill Registry

**Delegator use only.** Any agent that launches sub-agents reads this registry to resolve compact rules, then injects them directly into sub-agent prompts. Sub-agents do NOT read this registry or individual SKILL.md files.

See `_shared/skill-resolver.md` for the full resolution protocol.

## User Skills

| Trigger | Skill | Path |
|---------|-------|------|
| This skill is for interface design — dashboards, admin panels, apps, tools, and interactive products. NOT for marketing design (landing pages, marketing sites, campaigns). | interface-design | C:\Users\nelso\Documents\Docker Proyectos\Diseñador-Politicas-sw1\.agents\skills\interface-design\SKILL.md |

## Compact Rules

Pre-digested rules per skill. Delegators copy matching blocks into sub-agent prompts as `## Project Standards (auto-resolved)`.

### interface-design
- Always define Intent first: who the user is, what they must accomplish, and how it should feel.
- Explore Product Domain before building: define concepts, color world, and a unique signature.
- Reject defaults explicitly; avoid generic templates.
- Use a surface elevation system: base layer, then slightly lighter (dark mode) or shadowed (light mode) surfaces.
- Use soft, low-opacity borders for separation rather than harsh solid hex colors.
- Build 4 levels of text hierarchy (primary, secondary, tertiary, muted) and use a consistent spacing base unit.
- Build custom UI controls rather than relying on unstylable OS-native elements (`<select>`, `<input type="date">`).
- Run the swap, squint, signature, and token tests before presenting output.
- Every interactive element needs state definition (hover, active, focus, disabled, loading, empty, error).

## Project Conventions

| File | Path | Notes |
|------|------|-------|

Read the convention files listed above for project-specific patterns and rules. All referenced paths have been extracted — no need to read index files to discover more.