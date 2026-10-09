#include "prism/ai/page_context.h"

#include <cstdlib>
#include <iostream>
#include <string>
#include <utility>

namespace {

using namespace prism::ai;

void Require(bool condition, const char* message) {
  if (!condition) {
    std::cerr << "FAIL: " << message << '\n';
    std::exit(1);
  }
}

void TestRedactionAndReferences() {
  PageContextInput input;
  input.tab_id = 9;
  input.origin = "https://example.test";
  input.title = "Account access_token=top-secret";

  ContextNode text;
  text.node_id = 1;
  text.visible = true;
  text.visible_text =
      "Welcome\nAuthorization: Bearer abc123\n"
      "Cookie: sid=secret\nsession_token=token123";
  input.nodes.push_back(text);

  ContextNode password;
  password.node_id = 2;
  password.visible = true;
  password.interactive = true;
  password.editable = true;
  password.password = true;
  password.label = "Password";
  password.visible_text = "hunter2";
  password.form_value = "hunter2";
  input.nodes.push_back(password);

  ContextNode search;
  search.node_id = 3;
  search.visible = true;
  search.interactive = true;
  search.editable = true;
  search.role = "textbox";
  search.label = "Search";
  search.visible_text = "private search";
  search.form_value = "private search";
  input.nodes.push_back(search);

  ContextNode button;
  button.node_id = 4;
  button.visible = true;
  button.interactive = true;
  button.role = "button";
  button.label = "Submit";
  button.visible_text = "Submit";
  input.nodes.push_back(button);

  ContextNode hidden;
  hidden.node_id = 5;
  hidden.visible_text = "hidden text";
  input.nodes.push_back(hidden);

  PageContextExtractor extractor;
  const PageContextSnapshot snapshot = extractor.Extract(input);
  Require(snapshot.snapshot_id != 0, "snapshot should have an ID");
  Require(snapshot.elements.size() == 2,
          "only safe visible interactive nodes should have refs");
  Require(snapshot.elements.front().label == "Search",
          "editable field keeps a separate safe label");
  Require(snapshot.visible_text.find("Welcome") != std::string::npos,
          "visible text should be included");
  Require(snapshot.visible_text.find("hunter2") == std::string::npos,
          "password values must never be included");
  Require(snapshot.visible_text.find("private search") == std::string::npos,
          "editable values must never be included");
  Require(snapshot.visible_text.find("abc123") == std::string::npos,
          "authorization values must be redacted");
  Require(snapshot.visible_text.find("token123") == std::string::npos,
          "session tokens must be redacted");
  Require(snapshot.title.find("top-secret") == std::string::npos,
          "title tokens must be redacted");
  Require(snapshot.visible_text.find("hidden text") == std::string::npos,
          "hidden text must be omitted");
  Require(extractor.IsCurrent(snapshot.elements.front().ref),
          "emitted ref should be current");
  Require(!extractor.IsCurrent({9, snapshot.snapshot_id, 2}),
          "password ref must not be valid");

  const PageContextSnapshot next = extractor.Extract(input);
  Require(!extractor.IsCurrent(snapshot.elements.front().ref),
          "new snapshot invalidates old refs");
  Require(extractor.IsCurrent(next.elements.front().ref),
          "new ref should be valid");
  extractor.Invalidate(9);
  Require(!extractor.IsCurrent(next.elements.front().ref),
          "navigation invalidation removes refs");
}

void TestLimitsAndJwt() {
  PageContextInput input;
  input.tab_id = 2;
  ContextNode token;
  token.node_id = 1;
  token.visible = true;
  token.visible_text =
      "JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0."
      "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  input.nodes.push_back(token);
  for (int i = 2; i <= 202; ++i) {
    ContextNode node;
    node.node_id = i;
    node.visible = true;
    node.interactive = true;
    node.role = "button";
    node.label = "Button";
    input.nodes.push_back(node);
  }
  PageContextExtractor extractor;
  const PageContextSnapshot snapshot = extractor.Extract(input);
  Require(snapshot.truncated, "element cap should mark truncation");
  Require(snapshot.elements.size() == 200, "element cap should apply");
  Require(!extractor.IsCurrent({2, snapshot.snapshot_id, 202}),
          "omitted node must not be a valid ref");
  Require(
      snapshot.visible_text.find("eyJhbGciOiJIUzI1NiJ9") == std::string::npos,
      "JWT should be redacted from visible text");

  PageContextInput long_input;
  long_input.tab_id = 3;
  ContextNode long_text;
  long_text.node_id = 1;
  long_text.visible = true;
  long_text.visible_text.assign(100000, 'x');
  long_input.nodes.push_back(std::move(long_text));
  const PageContextSnapshot bounded = extractor.Extract(long_input);
  Require(bounded.truncated, "oversized input should mark truncation");
  Require(bounded.visible_text.size() <= 32768,
          "output text must respect the byte cap");
}

void TestFindUsesRedactedSnapshot() {
  PageContextInput input;
  input.tab_id = 4;
  ContextNode text;
  text.node_id = 1;
  text.visible = true;
  text.visible_text = "alpha access_token=secret alpha";
  input.nodes.push_back(text);
  PageContextExtractor extractor;
  const PageContextSnapshot snapshot = extractor.Extract(input);
  const PageFindOutput found = FindInSnapshot(snapshot, "alpha");
  Require(found.tab_id == 4 && found.snapshot_id == snapshot.snapshot_id &&
              found.matches.size() == 2,
          "find should return matches from the current snapshot");
  for (const PageFindMatch& match : found.matches) {
    Require(match.snippet.find("secret") == std::string::npos,
            "find snippet must use redacted text");
  }
  Require(FindInSnapshot(snapshot, "secret").matches.empty(),
          "redacted secret must not be searchable");

  PageContextSnapshot many;
  many.tab_id = 4;
  many.snapshot_id = 20;
  for (int i = 0; i < 30; ++i) {
    many.visible_text += "hit ";
  }
  const PageFindOutput capped = FindInSnapshot(many, "hit");
  Require(capped.matches.size() == 20 && capped.truncated,
          "find matches should be bounded");
}

}  // namespace

int main() {
  TestRedactionAndReferences();
  TestLimitsAndJwt();
  TestFindUsesRedactedSnapshot();
  std::cout << "page_context tests passed\n";
}
