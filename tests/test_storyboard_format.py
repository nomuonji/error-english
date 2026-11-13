import json
import pathlib
import unittest

from scripts import beat_to_request, content_ledger

ROOT = pathlib.Path(__file__).resolve().parents[1]


class StoryboardFormatTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.spec = json.loads((ROOT / "format-lab/story-example.json").read_text(encoding="utf-8"))

    def test_reference_story_passes_the_same_render_gate(self):
        self.assertEqual([], beat_to_request.check_spec(self.spec))

    def test_story_learning_targets_enter_the_content_ledger(self):
        self.assertEqual(["Let's not get ahead of ourselves."], content_ledger.targets(self.spec))

    def test_bad_animation_is_rejected(self):
        spec = json.loads(json.dumps(self.spec))
        spec["storyboard"][0]["animation"] = "spin"
        self.assertTrue(any("unsupported animation" in p for p in beat_to_request.check_spec(spec)))

    def test_overlong_story_is_rejected(self):
        spec = json.loads(json.dumps(self.spec))
        spec["storyboard"][-1]["until"] = 241
        self.assertTrue(any("42-240 units" in p for p in beat_to_request.check_spec(spec)))

    def test_unsupported_speech_is_rejected(self):
        spec = json.loads(json.dumps(self.spec))
        spec["storyboard"][2]["speech"]["voice"] = "unknown-voice"
        self.assertTrue(any("unsupported voice" in p for p in beat_to_request.check_spec(spec)))

    def test_malformed_learning_target_is_rejected_without_exception(self):
        spec = json.loads(json.dumps(self.spec))
        spec["learningTargets"][0] = "not-an-object"
        self.assertTrue(any("must be an object" in p for p in beat_to_request.check_spec(spec)))

    def test_story_requires_experiment_metadata(self):
        spec = json.loads(json.dumps(self.spec))
        spec.pop("experimentId")
        self.assertTrue(any("valid experimentId" in p for p in beat_to_request.check_spec(spec)))


if __name__ == "__main__":
    unittest.main()
