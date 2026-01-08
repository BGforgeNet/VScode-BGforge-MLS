// Test INTERJECT - one-time NPC interjections
// Based on real WeiDU examples

// Multi-speaker INTERJECT with conditions
interject("IDRYAD1", "1", "MinscDryad", () => {
    if (IsValidForPartyDialog("Minsc")) {
        say("MINSCJ", tra(100));
    }
    if (IsValidForPartyDialog("Minsc")) {
        say("IDRYAD1", tra(101));
    }
}, "IDRYAD2", "1");

// INTERJECT_COPY_TRANS with multiple speakers
interjectCopyTrans("TOLGER", "75", "AquaTolger", () => {
    if (IsValidForPartyDialogue("Aqualung")) {
        say("AQUALUNJ", tra(200));
    }
    if (IsValidForPartyDialogue("Aqualung")) {
        say("TOLGER", tra(201));
    }
});
