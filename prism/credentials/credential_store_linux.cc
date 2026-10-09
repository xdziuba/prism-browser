#include "prism/credentials/credential_store_platform.h"

#include <algorithm>
#include <string>

#include <libsecret/secret.h>

#include "base/native_library.h"
#include "base/no_destructor.h"

namespace prism::credentials {
namespace {

constexpr char kAccount[] = "openai-default";
const SecretSchema kSchema = {
    "org.prismbrowser.OpenAI",
    SECRET_SCHEMA_NONE,
    {{"account", SECRET_SCHEMA_ATTRIBUTE_STRING}, {nullptr, 0}}};

struct LibsecretApi {
  LibsecretApi() {
    library =
        base::LoadNativeLibrary(base::FilePath("libsecret-1.so.0"), nullptr);
    if (!library) {
      return;
    }
    store = reinterpret_cast<decltype(&secret_password_store_sync)>(
        base::GetFunctionPointerFromNativeLibrary(
            library, "secret_password_store_sync"));
    lookup = reinterpret_cast<decltype(&secret_password_lookup_sync)>(
        base::GetFunctionPointerFromNativeLibrary(
            library, "secret_password_lookup_sync"));
    clear = reinterpret_cast<decltype(&secret_password_clear_sync)>(
        base::GetFunctionPointerFromNativeLibrary(
            library, "secret_password_clear_sync"));
    free_password = reinterpret_cast<decltype(&secret_password_free)>(
        base::GetFunctionPointerFromNativeLibrary(library,
                                                  "secret_password_free"));
  }

  bool available() const { return store && lookup && clear && free_password; }

  base::NativeLibrary library = nullptr;
  decltype(&secret_password_store_sync) store = nullptr;
  decltype(&secret_password_lookup_sync) lookup = nullptr;
  decltype(&secret_password_clear_sync) clear = nullptr;
  decltype(&secret_password_free) free_password = nullptr;
};

const LibsecretApi& Api() {
  static const base::NoDestructor<LibsecretApi> api;
  return *api;
}

bool HasError(GError* error) {
  if (!error) {
    return false;
  }
  g_error_free(error);
  return true;
}

}  // namespace

bool SaveOnWorker(std::string api_key) {
  const LibsecretApi& api = Api();
  if (!api.available()) {
    std::fill(api_key.begin(), api_key.end(), '\0');
    return false;
  }
  GError* error = nullptr;
  const gboolean saved = api.store(
      &kSchema, SECRET_COLLECTION_DEFAULT, "Prism Browser OpenAI API key",
      api_key.c_str(), nullptr, &error, "account", kAccount, nullptr);
  std::fill(api_key.begin(), api_key.end(), '\0');
  return !HasError(error) && saved;
}

LoadedCredential LoadOnWorker() {
  const LibsecretApi& api = Api();
  if (!api.available()) {
    return {LoadStatus::kUnavailable, {}};
  }
  GError* error = nullptr;
  gchar* secret =
      api.lookup(&kSchema, nullptr, &error, "account", kAccount, nullptr);
  if (HasError(error)) {
    if (secret) {
      api.free_password(secret);
    }
    return {LoadStatus::kUnavailable, {}};
  }
  if (!secret) {
    return {LoadStatus::kNotFound, {}};
  }
  std::string api_key(secret);
  api.free_password(secret);
  if (api_key.empty() || api_key.size() > 1024) {
    std::fill(api_key.begin(), api_key.end(), '\0');
    return {LoadStatus::kUnavailable, {}};
  }
  return {LoadStatus::kLoaded, std::move(api_key)};
}

bool RemoveOnWorker() {
  const LibsecretApi& api = Api();
  if (!api.available()) {
    return false;
  }
  GError* error = nullptr;
  const gboolean removed =
      api.clear(&kSchema, nullptr, &error, "account", kAccount, nullptr);
  return !HasError(error) && removed;
}

}  // namespace prism::credentials
