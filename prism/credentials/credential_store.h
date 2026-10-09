#ifndef PRISM_CREDENTIALS_CREDENTIAL_STORE_H_
#define PRISM_CREDENTIALS_CREDENTIAL_STORE_H_

#include <string>

#include "base/functional/callback.h"

namespace prism::credentials {

enum class LoadStatus { kLoaded, kNotFound, kUnavailable };

struct LoadedCredential {
  LoadStatus status = LoadStatus::kUnavailable;
  std::string api_key;
};

// Runs OS-vault operations on worker threads and replies on the calling
// sequence. No profile preference or local file contains the key.
class CredentialStore {
 public:
  using SaveCallback = base::OnceCallback<void(bool)>;
  using LoadCallback = base::OnceCallback<void(LoadedCredential)>;

  static void Save(std::string api_key, SaveCallback callback);
  static void Load(LoadCallback callback);
  static void Remove(SaveCallback callback);
};

}  // namespace prism::credentials

#endif  // PRISM_CREDENTIALS_CREDENTIAL_STORE_H_
