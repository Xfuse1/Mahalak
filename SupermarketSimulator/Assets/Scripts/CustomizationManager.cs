using UnityEngine;

public class CustomizationManager : MonoBehaviour
{
    public static CustomizationManager Instance;

    public Renderer playerGloveRenderer; // Assign in Inspector
    public Material[] gloveMaterials; // List of available colors

    private void Awake()
    {
        if (Instance == null) Instance = this;
    }

    public void ChangeGloveColor(int index)
    {
        if (playerGloveRenderer != null && index < gloveMaterials.Length)
        {
            playerGloveRenderer.material = gloveMaterials[index];
            SoundManager.Instance.PlayUIClick();
            Debug.Log("Glove color changed!");
        }
    }
}
