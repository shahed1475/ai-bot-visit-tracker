from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("ai_bot_tracker", "0001_initial")]
    operations = [
        migrations.AlterField(
            model_name="botvisit",
            name="classification",
            field=models.CharField(
                choices=[("training", "Training"), ("indexing", "Indexing"), ("retrieval", "Retrieval"), ("unknown", "Unknown")],
                db_index=True, default="unknown", max_length=20),
        ),
    ]
