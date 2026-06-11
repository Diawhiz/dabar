# Generated manually for the Phase 2 transcript segment model.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("sermons", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TranscriptSegment",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("start_time", models.FloatField()),
                ("end_time", models.FloatField()),
                ("text", models.TextField()),
                ("segment_index", models.IntegerField()),
                (
                    "sermon",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="segments",
                        to="sermons.sermon",
                    ),
                ),
            ],
            options={
                "ordering": ["segment_index"],
                "unique_together": {("sermon", "segment_index")},
            },
        ),
    ]
