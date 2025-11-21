import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    
    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        // Capacitor manages the root view via AppDelegate; nothing extra required here.
        guard (scene as? UIWindowScene) != nil else { return }
    }
}
