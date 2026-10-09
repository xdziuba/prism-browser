#include "prism/credentials/credential_store_platform.h"

#include <algorithm>
#include <string>

#include <wincred.h>
#include <windows.h>

namespace prism::credentials {
namespace {

constexpr wchar_t kTarget[] = L"Prism Browser/OpenAI/default";

}  // namespace

bool SaveOnWorker(std::string api_key) {
  CREDENTIALW credential = {};
  credential.Type = CRED_TYPE_GENERIC;
  credential.TargetName = const_cast<LPWSTR>(kTarget);
  credential.CredentialBlobSize = static_cast<DWORD>(api_key.size());
  credential.CredentialBlob = reinterpret_cast<LPBYTE>(api_key.data());
  credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
  credential.UserName = const_cast<LPWSTR>(L"OpenAI");
  const BOOL saved = CredWriteW(&credential, 0);
  SecureZeroMemory(api_key.data(), api_key.size());
  return saved != FALSE;
}

LoadedCredential LoadOnWorker() {
  PCREDENTIALW credential = nullptr;
  if (!CredReadW(kTarget, CRED_TYPE_GENERIC, 0, &credential)) {
    return {GetLastError() == ERROR_NOT_FOUND ? LoadStatus::kNotFound
                                              : LoadStatus::kUnavailable,
            {}};
  }
  LoadedCredential result;
  if (credential->CredentialBlob && credential->CredentialBlobSize > 0 &&
      credential->CredentialBlobSize <= 1024) {
    result.status = LoadStatus::kLoaded;
    result.api_key.assign(
        reinterpret_cast<const char*>(credential->CredentialBlob),
        credential->CredentialBlobSize);
  }
  CredFree(credential);
  return result;
}

bool RemoveOnWorker() {
  return CredDeleteW(kTarget, CRED_TYPE_GENERIC, 0) != FALSE;
}

}  // namespace prism::credentials
