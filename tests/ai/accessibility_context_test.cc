#include "prism/ai/accessibility_context.h"

#include <cstdlib>
#include <iostream>
#include <string>

namespace {

using namespace prism::ai;

void Require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

void TestSensitiveSubtreesAndUnreachableNodes() {
  AccessibilityTreeInput tree;
  tree.tab_id = 7;
  tree.root_id = 1;
  tree.origin = "https://example.test";
  tree.nodes = {
      {1, {2, 3, 4, 5, 6}, AccessibilityRole::kOther, ""},
      {2, {}, AccessibilityRole::kStaticText, "Visible summary"},
      {3,
       {7},
       AccessibilityRole::kTextField,
       "Password",
       false,
       false,
       true,
       true},
      {4, {8}, AccessibilityRole::kOther, "", true},
      {5, {}, AccessibilityRole::kButton, "Continue"},
      {6, {}, AccessibilityRole::kOther, "Ignored"},
      {7, {}, AccessibilityRole::kStaticText, "SECRET_VALUE"},
      {8, {}, AccessibilityRole::kStaticText, "HIDDEN_VALUE"},
      {9, {}, AccessibilityRole::kStaticText, "UNREACHABLE_VALUE"},
  };
  PageContextInput input = BuildPageContextInput(tree);
  Require(input.nodes.size() == 2, "only visible safe roles should pass");
  Require(input.nodes[0].visible_text == "Visible summary",
          "static text should pass");
  Require(input.nodes[1].interactive && input.nodes[1].label == "Continue",
          "button should become a semantic element");
  PageContextExtractor extractor;
  PageContextSnapshot snapshot = extractor.Extract(input);
  Require(snapshot.visible_text.find("SECRET_VALUE") == std::string::npos &&
              snapshot.visible_text.find("HIDDEN_VALUE") == std::string::npos,
          "sensitive descendants must stay out of the snapshot");
  Require(snapshot.elements.size() == 1 &&
              extractor.IsCurrent(snapshot.elements[0].ref),
          "button should get a current semantic reference");
}

void TestMalformedAndTruncatedTree() {
  AccessibilityTreeInput duplicate;
  duplicate.tab_id = 7;
  duplicate.root_id = 1;
  duplicate.nodes = {{1, {}, AccessibilityRole::kOther, ""},
                     {1, {}, AccessibilityRole::kOther, ""}};
  Require(BuildPageContextInput(duplicate).tab_id == 0,
          "duplicate node IDs should fail closed");

  AccessibilityTreeInput large;
  large.tab_id = 7;
  large.root_id = 1;
  large.nodes.push_back(
      {1, {2}, AccessibilityRole::kOther, "", false, false, false, false});
  large.nodes.push_back(
      {2, {}, AccessibilityRole::kStaticText, std::string(5000, 'a')});
  PageContextInput input = BuildPageContextInput(large);
  Require(input.truncated && input.nodes[0].visible_text.size() == 4096,
          "oversized AX name should be bounded");
  PageContextExtractor extractor;
  Require(extractor.Extract(input).truncated,
          "AX truncation should survive extraction");
}

}  // namespace

int main() {
  TestSensitiveSubtreesAndUnreachableNodes();
  TestMalformedAndTruncatedTree();
  std::cout << "accessibility context tests passed\n";
}
