# QAHub Evals

This folder is the accuracy harness for QAHub.

The goal is to turn "95% accuracy" into measurable gates:

- Steel spec pass/fail correctness
- Heat/coil/sample/MTR traceability correctness
- Review finding coverage
- Test category coverage
- JSON/schema validity for saved model outputs

## Run

```bash
npm run eval
```

By default, the runner scores deterministic steel-domain tools against
`golden-items.json`. If `evals/latest-output.json` exists, it also scores model
outputs.

## Optional Model Output File

Create `evals/latest-output.json` with outputs keyed by golden item id:

```json
{
  "golden-a572-yield-retest": {
    "review": {
      "summary": "Flags yield below min and holds the MTR for QA disposition.",
      "blockers": ["Yield 49.2 ksi is below A572 Grade 50 minimum."]
    },
    "testCases": {
      "testCases": [
        { "category": "Functional", "title": "Flag below-min yield" },
        { "category": "Negative", "title": "Block MTR release" },
        { "category": "Regression", "title": "Existing pass result still releases" }
      ]
    }
  }
}
```

The runner will report coverage gaps instead of requiring a live LLM call. That
keeps the eval stable, cheap, and CI-friendly.
