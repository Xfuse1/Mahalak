using UnityEngine;

public class SoundManager : MonoBehaviour
{
    public static SoundManager Instance;

    [Header("Audio Sources")]
    public AudioSource sfxSource;
    public AudioSource musicSource;

    [Header("Audio Clips")]
    public AudioClip grabItemClip;
    public AudioClip dropInCartClip;
    public AudioClip uiClickClip;
    public AudioClip checkoutSuccessClip;
    public AudioClip healthyPointClip;
    public AudioClip timerWarningClip;

    private void Awake()
    {
        if (Instance == null) Instance = this;
    }

    public void PlaySFX(AudioClip clip)
    {
        if (clip != null)
        {
            sfxSource.PlayOneShot(clip);
        }
    }

    public void PlayGrab() => PlaySFX(grabItemClip);
    public void PlayDrop() => PlaySFX(dropInCartClip);
    public void PlayUIClick() => PlaySFX(uiClickClip);
    public void PlayCheckout() => PlaySFX(checkoutSuccessClip);
    public void PlayHealthyPoint() => PlaySFX(healthyPointClip);
}
